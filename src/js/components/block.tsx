import React, { useEffect, useId, useRef, useState } from 'react';
import { model } from '../types/interface';
import { chromeService } from '../chromeService';
import { openableTab, Tab } from './tab';
import BrokenTab from './brokenTab';
import EditTabModal from './editTabModal';
import { ErrorBoundary } from './errorBoundary';
import { useBlockFlagToggle } from './useBlockFlagToggle';

// 名前の入力欄に入れられる長さの上限。カードの見出しに収まる長さに抑えることと、
// storage.syncの8KB/item制限を名前で圧迫しないことが目的。
// 入力欄のmaxLengthとしてだけ効かせ、インポートしたデータがこれより長い名前を
// 持っていた場合は黙って切り捨てず、そのまま保持する
const BLOCK_TITLE_MAX_LENGTH = 100;

// タブの同一性はURLと名前で見る。indexは一覧の読み直し(#249)や
// 同じカードへの別の操作でずれるため、chrome.tabs.createを待っている間に
// 別のタブを指しうる。indexのまま書き戻すと無関係なタブを消してしまう。
// 保存データが壊れているとタブ自体がnullのこともあり、その場合は
// 内容で見分けられないので同じ「壊れたタブ」として扱う
const sameTab = (a: model.Tab, b: model.Tab): boolean => {
  if (a == null || b == null) {
    return a === b;
  }
  return a.url === b.url && a.title === b.title;
};

// クリックした時点のタブを、書き込む直前の一覧で指し直す。
// 同じURL・名前のタブが並んでいると内容だけでは押した行を特定できないため、
// まずindexの位置が同じ内容のままかを確かめ、ずれていたら内容で探す
const findTabIndex = (
  tabs: model.Tab[],
  target: model.Tab,
  index: number,
): number => {
  if (index >= 0 && index < tabs.length && sameTab(tabs[index]!, target)) {
    return index;
  }
  return tabs.findIndex((tab) => sameTab(tab, target));
};

interface BlockProps {
  block: model.Block;
  // storageへの永続化とブロック一覧stateの更新はApp側で行う。
  // 更新内容ではなく更新関数を渡すのは、書き込む直前の内容の上に
  // 変更を載せるため（クリック時のpropsを閉じ込めたまま書き戻すと、
  // その間に消したはずのブロックやタブが復活する）。
  // 永続化に失敗するとrejectされる（失敗の記録はApp側で済んでいる）
  updateBlock: (
    indexNum: number,
    update: (current: model.Block) => model.Block,
  ) => Promise<void>;
}

// ブロックのstateはAppが所有し、Blockはpropsの表示と操作イベントの発火に徹する。
// memo化により、他ブロック更新時の再レンダリングを避ける
// （updateBlockはApp側でuseCallbackにより参照が安定している前提）
const Block: React.FC<BlockProps> = React.memo((props) => {
  const block = props.block;
  const createdAt = block.createdAt;
  // 編集中のタブのindex。nullなら編集モーダルを出さない
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // 編集を始めた時点のタブ。編集対象はindexで指しているため、開いている間に
  // 一覧が読み直されると（#249。他のtabsページ・他端末の変更）同じindexが
  // 別のタブを指しうる。開いたタブと突き合わせて、無関係なタブを
  // 上書きしないための控え
  const [editTarget, setEditTarget] = useState<model.Tab | null>(null);
  // 名前の編集中かどうか。編集を始めたときの名前をdraftの初期値にする
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleFieldId = useId();
  const titleHintId = useId();
  // 飛行中のタブ書き換えの本数。propsを見ても決着していない書き込みは
  // 分からないため、名前の編集を始めさせないための判断材料として自前で数える
  const tabWritesInFlight = useRef(0);
  const [tabsWriting, setTabsWriting] = useState(false);

  /**
   * タブを書き換える一連の処理が飛行中であることを記録する。
   * 名前もタブもブロックごと書き戻すため、両者が並行すると後から着地した側が
   * 相手の変更を打ち消す（名前が消える・開いたタブが一覧に戻る）。
   * 名前を編集している間はタブ側の導線をinertで止めているので、
   * その裏返しとしてタブ側が飛行している間は名前の編集を始めさせない
   * @param {Promise} work 追跡する処理
   * @return {Promise} workと同じ結果を返すPromise
   */
  const trackTabWrite = <T,>(work: Promise<T>): Promise<T> => {
    tabWritesInFlight.current += 1;
    setTabsWriting(true);
    const settled = (): void => {
      tabWritesInFlight.current -= 1;
      if (tabWritesInFlight.current <= 0) {
        setTabsWriting(false);
      }
    };
    return work.then(
      (value) => {
        settled();
        return value;
      },
      (error) => {
        settled();
        throw error;
      },
    );
  };

  /*
   * カード全体に効く真偽値フラグの切り替え。
   * ロックとお気に入りは同じ振る舞いなので同じフックへ寄せる(#254)。
   *
   * canStartに関数を渡すのは、開始条件（blockWriteBusy）が
   * 両方のsavingを含むため。フックを呼ぶ時点ではまだ算出できないので、
   * クリックの時点で評価する。
   *
   * ロックの切り替えは、着地するまでpropsのlockedが古いままで、その隙に
   * 始まったタブ操作がロックを知らないまま書き戻してしまうため、
   * 名前の保存と同じようにタブ側の導線も止める（tabsLocked）。
   *
   * お気に入りはロック中でも押せる。並び順と装飾にしか効かず、タブを失う
   * 操作ではないため。なおロック中のブロックをstorageへ書き戻せる＝保存は
   * 常に現在のスキーマ版数で行われる（v1/v2で保存されていたブロックはv3に
   * なる）。ロックはこの拡張機能のUIでの誤操作を防ぐもので、保存データを
   * 変えさせない仕組みではない、という既存の立場のままとする
   */
  const lock = useBlockFlagToggle({
    block: block,
    field: 'locked',
    updateBlock: props.updateBlock,
    track: trackTabWrite,
    canStart: () => !blockWriteBusy,
    failureMessageKey: 'content_msg_lock_block_save_failed',
  });
  const star = useBlockFlagToggle({
    block: block,
    field: 'starred',
    updateBlock: props.updateBlock,
    track: trackTabWrite,
    canStart: () => !blockWriteBusy,
    failureMessageKey: 'content_msg_star_block_save_failed',
    // お気に入りはカードが一覧内を移動する。フォーカスに伴うブラウザの
    // 瞬間スクロールが、useBlockMoveAnimationがカードの移動に合わせて
    // 見せているスクロールを乱すため抑える
    preventScroll: true,
  });

  // 誤操作からブロックを守るための状態。ロック中は削除・編集の導線を止め、
  // リンクを開いてもタブを一覧から消さない
  const locked = lock.active;

  // お気に入りかどうか。一覧での並び順と装飾にしか影響しない
  const starred = star.active;

  // タブ配列の差し替えをApp経由でstorageへ反映する。
  // updateBlockはブロックごと書き戻すため、タブだけを変える導線でも
  // タブ以外のフィールドを引き継がないと保存のたびに消える
  const updateTabs = (
    nextTabs: (current: model.Block) => model.Tab[],
  ): Promise<void> => {
    // storageへ書く唯一の入口でロックを見る。各導線側のガードだけに預けると、
    // 導線が増えたときに保護が黙って漏れる
    if (locked) {
      return Promise.reject(new Error('This block is locked'));
    }
    return trackTabWrite(
      props.updateBlock(block.indexNum, (current) => {
        // 書き込む直前の内容でもロックを見る。押した時点で解除されていても、
        // 待っている間にロックされたブロックへ書き戻すと、
        // ロックが守るはずだったタブを消してしまう
        if (current.locked === true) {
          throw new Error('This block is locked');
        }
        return {
          ...current,
          tabs: nextTabs(current),
        };
      }),
    );
  };

  // 押した行のタブを取り除く。書き込む直前の一覧で指し直すため、
  // 待っている間に並びが変わっていても無関係なタブを巻き込まない
  const removeTabAt = (index: number): Promise<void> => {
    const target = block.tabs[index]!;
    return updateTabs((current) => {
      const at = findTabIndex(current.tabs, target, index);
      if (at < 0) {
        // 待っている間に他の操作で消えていた。書き戻す必要がないので、
        // storage.syncの書き込みクォータを無駄に使わずここで降りる
        throw new Error('tab already removed');
      }
      return current.tabs.filter((_, i) => i != at);
    });
  };

  // 指定したタブをまとめて取り除く。同じURL・名前のタブが複数あっても
  // 指定した本数だけを消すため、まとめてfilterせず1件ずつ引く
  const removeTabs = (targets: model.Tab[]): Promise<void> =>
    updateTabs((current) => {
      const remaining = [...current.tabs];
      for (const target of targets) {
        const at = remaining.findIndex((tab) => sameTab(tab, target));
        if (at >= 0) {
          remaining.splice(at, 1);
        }
      }
      if (remaining.length === current.tabs.length) {
        // 待っている間に他の操作で消えていた。書き戻す必要がないので、
        // storage.syncの書き込みクォータを無駄に使わずここで降りる
        throw new Error('tabs already removed');
      }
      return remaining;
    });

  // 結果を待たない導線用。失敗はApp側でerrorLogに記録済みなので、
  // ここで受けないとunhandled rejectionになるだけ
  const removeTabAtIgnoringFailure = (index: number): void => {
    removeTabAt(index).catch(() => {});
  };

  const openLink = (index: number) => {
    const target = block.tabs[index]!;
    if (locked) {
      // ロック中は開くだけで一覧から消さない。書き戻しが要らないため
      // 飛行中としても数えない
      chromeService.tab
        .createTabs({ url: target.url, active: false })
        .catch((error) => {
          chromeService.errorLog.set(error).catch(console.error);
        });
      return;
    }
    // タブを開き終わってから書き戻すまでが1つの操作なので、
    // chrome.tabs.createを待つ間も飛行中として数える
    trackTabWrite(
      chromeService.tab
        .createTabs({ url: target.url, active: false })
        // 開いたタブそのものを消す。書き込む直前の一覧で指し直すので、
        // 待っている間に並びが変わっていても無関係なタブを巻き込まない
        .then(() => removeTabAtIgnoringFailure(index)),
    ).catch((error) => {
      chromeService.errorLog.set(error).catch(console.error);
    });
  };

  const deleteClick = (index: number) => {
    // 呼び出し元の導線はロック中に塞いであるが、不変条件をUIの分岐だけに
    // 預けると導線が増えたときに保護が黙って外れる
    if (locked) {
      return;
    }
    removeTabAtIgnoringFailure(index);
  };

  // 保存できたときだけモーダルを閉じる。失敗時はrejectをモーダル側へ返し、
  // 入力を残したまま再試行できるようにする
  const saveEditedTab = (newTab: model.Tab): Promise<void> => {
    // 編集を始めたタブが見つからないなら書かない。モーダル側でも保存を
    // 止めているが、保護をUIの分岐だけに預けると導線が増えたときに
    // 黙って外れる（見つからないまま書くと無関係なタブを上書きする）
    if (editTargetIndex < 0) {
      return Promise.reject(new Error('edit target lost'));
    }
    return updateTabs((current) => {
      // 書き込む直前の一覧で指し直す。propsのindexは待っている間に
      // ずれうるので、そのまま使うと別のタブを上書きする
      const at = findEditTargetIn(current.tabs);
      if (at < 0) {
        throw new Error('edit target lost');
      }
      return current.tabs.map((tab, i) => (i == at ? newTab : tab));
    }).then(() => {
      closeTabEdit();
    });
  };

  const openAllTab = () => {
    // 壊れたタブを踏むとmapの途中で例外になり、残りのタブが開かれないまま
    // イベントハンドラの外へ抜けて通知もされないため、開ける分だけに絞る
    const openTabs = block.tabs.filter(openableTab);
    if (openTabs.length <= 0) {
      // 開くものがないのに書き戻すと、storage.syncの書き込みクォータを
      // 無駄に消費するだけで一覧も変わらない
      return;
    }
    if (locked) {
      // ロック中は開くだけで一覧から消さない
      Promise.all(
        openTabs.map((tab) =>
          chromeService.tab.createTabs({ url: tab.url, active: false }),
        ),
      ).catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
      return;
    }
    // 開き終わってから書き戻すまでを1つの操作としてまとめて数える。
    // 途中で飛行中でなくなると、その隙に名前の編集を始められてしまう。
    // 1件でも開けなかったら1本も消さない（Promise.all）。
    // 開けた分だけ消すと、失敗したタブだけが残ったのか
    // 全部残ったのかをユーザーが見分けられない
    trackTabWrite(
      Promise.all(
        openTabs.map((tab) =>
          chromeService.tab.createTabs({ url: tab.url, active: false }),
        ),
      ).then(() => {
        // 開いたタブだけを消す。開けなかったタブまでブロックごと消すと、
        // 一覧に見えていたタブが開かれもせず失われる
        removeTabs(openTabs).catch(() => {});
      }),
    ).catch((error) => {
      chromeService.errorLog.set(error).catch(console.error);
    });
  };

  const deleteBlock = () => {
    if (locked) {
      return;
    }
    // タブが空になったブロックはstorage側で削除される
    updateTabs(() => []).catch(() => {});
  };

  // Tab側でもロック中は編集アイコンを無効化しているが、モーダルを開く判断は
  // ブロックの状態を持つこちらでも確かめる
  const startTabEdit = (index: number) => {
    if (locked) {
      return;
    }
    const target = block.tabs[index];
    if (target == null) {
      return;
    }
    setEditIndex(index);
    setEditTarget(target);
  };

  const closeTabEdit = () => {
    setEditIndex(null);
    setEditTarget(null);
  };

  const startTitleEdit = () => {
    // ボタンのdisabledとヘッダのinertで塞いでいるが、不変条件をDOMの属性だけに
    // 預けると、ボタンの置き場所を変えたときに保護が黙って外れる
    if (tabsWriting || editing || locked) {
      return;
    }
    setTitleDraft(block.title ?? '');
    setTitleError(null);
  };

  const cancelTitleEdit = () => {
    setTitleDraft(null);
    setTitleError(null);
  };

  // 名前はタブのリンク名と違ってクリックの可否に関わらないため、必須にしない。
  // 空欄での保存は「名前を消す」操作とみなし、デフォルトのタブ数表示に戻す
  const submitTitle = (event: React.FormEvent): void => {
    event.preventDefault();
    // 保存ボタンのdisabledでEnterによる暗黙のsubmitも止まるが、submitの起点が
    // 増えたときに二重書き込み（storage.syncの書き込みクォータも二重消費）に
    // ならないようにここでも弾く
    if (titleSaving) {
      return;
    }
    const newTitle = (titleDraft ?? '').trim();
    setTitleError(null);
    setTitleSaving(true);
    props
      .updateBlock(block.indexNum, (current) => ({
        // 編集している間はタブ側の導線を止めてあるので、このページの操作では
        // タブ配列は変わらない。一覧の読み直し(#249)や他端末の変更で
        // 変わることはあるため、書き込む直前の内容に名前だけを載せる
        ...current,
        title: newTitle.length <= 0 ? undefined : newTitle,
      }))
      .then(() => {
        setTitleDraft(null);
        setTitleSaving(false);
      })
      .catch(() => {
        // App側がerrorLogへ記録するアラートはページ最上部に出るため、
        // 画面をスクロールしていると気付けない。カード内でも失敗を伝え、
        // 入力を残したまま再試行できる状態に戻す
        setTitleError(
          chrome.i18n.getMessage('content_msg_edit_block_title_save_failed'),
        );
        setTitleSaving(false);
      });
  };

  // 入力欄からEscapeで編集をやめられるようにする。保存中は書き込みの結果を
  // 受け取る相手がいなくなるため効かせない（キャンセルボタンと同じ扱い）
  const onTitleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape' && !titleSaving) {
      cancelTitleEdit();
    }
  };

  // 編集をやめると見出しごとフォームが消えるため、フォーカスがbodyまで落ちて
  // キーボード操作の現在位置が失われる。開いたときのボタンへ戻す
  const cardRoot = useRef<HTMLDivElement>(null);
  const titleEditButton = useRef<HTMLButtonElement>(null);
  const titleWasEditing = useRef(false);
  useEffect(() => {
    if (titleWasEditing.current && titleDraft == null) {
      // 保存は非同期なので、待っている間にユーザーが別の要素へフォーカスを
      // 移していることがある。そこから奪い返すと入力先が飛ぶため、
      // フォーカスがこのカードの中にあるか失われている場合だけ戻す
      const active = document.activeElement;
      if (
        active == null ||
        active === document.body ||
        cardRoot.current?.contains(active) === true
      ) {
        titleEditButton.current?.focus();
      }
    }
    titleWasEditing.current = titleDraft != null;
  }, [titleDraft]);

  // 編集対象のいまの位置。開いている間に一覧が読み直されるとindexの指す先が
  // ずれるため、ずれていたときだけ同じ内容のタブを探し直す。
  // 最初からindexを捨てて内容で探すと、同じURL・同じ名前のタブを複数持つ
  // ブロック（同じページを2枚開いて保存した場合など）で、常に先頭の重複を
  // 書き換えてしまう
  const findEditTargetIn = (tabs: model.Tab[]): number => {
    if (editTarget == null || editIndex == null) {
      return -1;
    }
    return findTabIndex(tabs, editTarget, editIndex);
  };
  const editTargetIndex = findEditTargetIn(block.tabs);
  // 編集していたタブが失われたか。この場合もモーダルは閉じず、入力を見せた
  // まま保存だけを止める（黙って消すと、書いていた内容が理由も分からず
  // 失われる）。ブロックごと消えた場合はカードがアンマウントされるため、
  // ここでは救えない
  const editTargetLost = editTarget != null && editTargetIndex < 0;
  // モーダルのオーバーレイはクリックしか遮らず、背後のリンクにはTabキーで
  // 到達できてしまう。開いている間にこのブロックのタブが増減すると、
  // 後から着地した保存が消したはずのタブを書き戻す。背後を操作不能にして塞ぐ
  // （aria-modalを名乗る以上、支援技術に対しても背後は無効であるべき）
  const editing = editTarget != null && editIndex != null;
  const titleEditing = titleDraft != null;
  // 名前もタブもブロックごと書き戻すため、両者が並行すると後から着地した側が
  // 相手の変更を打ち消す（名前が消える・開いたタブが一覧に戻る）。
  // 飛行中の書き込みはpropsから分からないので、そもそも同時に始められない
  // ようにして塞ぐ。片方向だけでは「タブ操作の最中に名前を保存する」順序が
  // 残るため、名前→タブ（tabsLocked）とタブ→名前（tabsWriting）の両方を止める。
  // 見出しの入力欄自体は編集中も操作できる必要があるので、
  // inertはヘッダ全体ではなく操作リンクの行に付ける。
  // ロックの書き込み中も同じ理由でタブ側を止める。着地するまでpropsのlockedは
  // 古いままで、その間に始まったタブ操作はロックを知らないまま書き戻す。
  // スターの書き込み中も同じ（着地前のタブ操作はスターごと書き戻してしまう）
  const tabsLocked = editing || titleEditing || lock.saving || star.saving;
  // カード全体に効く操作（ロック・お気に入り）を始めてよいか。
  // どれもブロックごと書き戻すため、他の書き込みと並行すると打ち消し合う。
  // ボタンのdisabledでも塞いでいるが、保護をDOMの属性だけに預けない
  const blockWriteBusy = tabsWriting || tabsLocked;

  return (
    <div
      className="tabs uk-card-default block-root-dom"
      // 並び替えで動いたカードを見分けるための印。
      // useBlockMoveAnimationがこれで位置を追跡する
      data-block-index={block.indexNum}
      ref={cardRoot}
    >
      {/* お気に入りのリボン。一覧を眺めたときに目を引くのが役目なので、
          カード上端の全幅ではなく左肩に旗のように出す。
          アイコンや色だけの強調にしないため文字も入れる。
          支援技術にはロック中バッジと同じく見出しの中で伝えるため
          （見出し送りで状態を拾えるようにする）、リボン自体はaria-hiddenで
          二重に読ませない */}
      {starred ? (
        <div className="block-star-ribbon" aria-hidden={true}>
          <span data-uk-icon="icon: star; ratio: 0.7" />
          {chrome.i18n.getMessage('content_msg_starred_ribbon')}
        </div>
      ) : null}
      <div className="uk-card-header block-card-header" inert={editing}>
        {/* お気に入りの切り替えはロックと並べてカードの右上に置く。
            どちらもカード全体に効く操作で、粒度が揃っているため。
            ロックと違いロック中でも押せる（並び順と装飾しか変えない）。
            状態はロックと同じ理由でaria-pressedではなく名前で伝える */}
        <button
          type="button"
          ref={star.buttonRef}
          className="uk-link block-star-toggle"
          data-starred={starred}
          data-uk-icon="icon: star; ratio: 0.9"
          title={chrome.i18n.getMessage(
            starred ? 'content_msg_unstar_block' : 'content_msg_star_block',
          )}
          aria-label={chrome.i18n.getMessage(
            starred ? 'content_msg_unstar_block' : 'content_msg_star_block',
          )}
          // ロックボタンと同じ理由。ブロックごとの書き戻しが打ち消し合う
          disabled={tabsWriting || titleEditing}
          onClick={star.toggle}
        />
        {/* ロックの切り替えはカードの右上に置く。名前の編集や個々のタブの
            操作より上位の、カード全体に効く操作であるため。
            アイコンだけでは何のボタンか分からないのでtitleで補い、
            支援技術にも同じ文言をaria-labelで渡す。
            状態はaria-pressedではなく名前（「ロックする」「解除する」）で
            伝える。両方を使うと「解除する」と「押されている」が重なって、
            解除済みなのかロック中なのか読み手に区別できなくなるうえ、
            見えているツールチップと名前が食い違って音声操作の的も外れる */}
        <button
          type="button"
          ref={lock.buttonRef}
          className="uk-link block-lock-toggle"
          data-locked={locked}
          data-uk-icon={`icon: ${locked ? 'lock' : 'unlock'}; ratio: 0.9`}
          title={chrome.i18n.getMessage(
            locked ? 'content_msg_unlock_block' : 'content_msg_lock_block',
          )}
          aria-label={chrome.i18n.getMessage(
            locked ? 'content_msg_unlock_block' : 'content_msg_lock_block',
          )}
          // 名前の編集中とタブの書き換え中は、ブロックごとの書き戻しが
          // 打ち消し合うため切り替えさせない
          disabled={tabsWriting || titleEditing}
          onClick={lock.toggle}
        />
        {titleEditing ? (
          <form
            className="block-title-form"
            onSubmit={submitTitle}
            onKeyDown={onTitleKeyDown}
          >
            <label className="uk-form-label" htmlFor={titleFieldId}>
              {chrome.i18n.getMessage('content_msg_edit_block_title_label')}
            </label>
            <input
              id={titleFieldId}
              className="uk-input block-title-input"
              type="text"
              value={titleDraft}
              maxLength={BLOCK_TITLE_MAX_LENGTH}
              autoFocus={true}
              aria-describedby={titleHintId}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
            {/* 空欄で保存できることは見ただけでは分からないため明示する */}
            <p className="uk-text-meta uk-margin-remove-top" id={titleHintId}>
              {chrome.i18n.getMessage('content_msg_edit_block_title_hint')}
            </p>
            {/* 保存ボタンが無反応に見えないよう、role=alertで読み上げさせる */}
            {titleError != null ? (
              <p className="uk-text-danger block-title-error" role="alert">
                {titleError}
              </p>
            ) : null}
            <div>
              <button
                type="button"
                className="uk-button uk-button-default block-title-cancel"
                disabled={titleSaving}
                onClick={cancelTitleEdit}
              >
                {chrome.i18n.getMessage('content_msg_edit_block_title_cancel')}
              </button>
              <button
                type="submit"
                className="uk-button uk-button-primary uk-margin-small-left block-title-save"
                disabled={titleSaving}
              >
                {chrome.i18n.getMessage('content_msg_edit_block_title_save')}
              </button>
            </div>
          </form>
        ) : (
          <h3 className="uk-card-title uk-margin-remove-bottom">
            {/* 名前なしのブロックはタブ数を見出しにする。空文字列は
                blockServiceの読み込み時にundefinedへ寄せているが、
                見出しが空のカードになると編集アイコンしか残らないため
                長さも見て判断する */}
            <span className="block-title">
              {block.title != null && block.title.length > 0
                ? block.title
                : chrome.i18n.getMessage('content_msg_tab_length', [
                    block.tabs.length,
                  ])}
            </span>
            {/* お気に入りであることを見出しの中でも伝える。見た目はリボンが
                担うのでここは支援技術専用にし（見えている文字が二重になる）、
                ロック中バッジと同じく見出し送りで状態を拾えるようにする */}
            {starred ? (
              <span className="uk-hidden-visually block-starred-status">
                {chrome.i18n.getMessage('content_msg_starred_ribbon')}
              </span>
            ) : null}
            {/* ロック中であることを見出しの隣で文字でも出す。アイコンの形だけに
                頼ると、色覚や視力の差、アイコンの見落としで状態を取り違える */}
            {locked ? (
              <span className="block-locked-badge">
                <span data-uk-icon="icon: lock; ratio: 0.7" />
                {chrome.i18n.getMessage('content_msg_locked_badge')}
              </span>
            ) : null}
            {/* 名前を付けるのはこの機能の主導線なので、タブ行のアイコン
                （span）と違ってキーボードから到達できるbutton要素で置く。
                アイコンだけでは何のボタンか分からないため、ホバー用のtitleに
                加えて支援技術向けにaria-labelでも名前を与える */}
            <button
              type="button"
              ref={titleEditButton}
              className="uk-link uk-margin-small-left block-title-edit"
              data-uk-icon="icon: pencil; ratio: 0.9"
              // 押せない理由はタブ行のアイコンと同じ文言で伝える
              title={
                locked
                  ? chrome.i18n.getMessage('content_msg_locked_action_disabled')
                  : chrome.i18n.getMessage('content_msg_edit_block_title')
              }
              aria-label={chrome.i18n.getMessage(
                'content_msg_edit_block_title',
              )}
              // タブの書き換えが決着するまでは名前を編集させない。
              // 並行させると後から着地した書き込みが名前を消す。
              // ロック中も名前は編集系の操作として止める
              disabled={tabsWriting || locked}
              onClick={startTitleEdit}
            />
          </h3>
        )}
        <p className="uk-text-meta uk-margin-remove-top">
          {chrome.i18n.getMessage('content_msg_created_at')}
          <time dateTime={createdAt.toISOString()}>
            {createdAt.toLocaleString()}
          </time>
          {/* 名前を付けると見出しからタブ数が消えるため、作成日と並ぶ
              メタ情報として現在のタブ数を出す */}
          <span className="uk-margin-small-left block-tab-count">
            {chrome.i18n.getMessage('content_msg_tab_count', [
              block.tabs.length,
            ])}
          </span>
        </p>
        {/* エラーはロックボタンと同じヘッダ内の、見出しの後に出す。
            見出しより前に差し込むとカードの中身が丸ごとずれて、
            どのブロックの話か分かりにくくなる */}
        {lock.error != null ? (
          <p className="uk-text-danger block-lock-error" role="alert">
            {lock.error}
          </p>
        ) : null}
        {star.error != null ? (
          <p className="uk-text-danger block-star-error" role="alert">
            {star.error}
          </p>
        ) : null}
        <div
          className="uk-grid"
          inert={titleEditing || lock.saving || star.saving}
        >
          <div className="uk-width-auto">
            <span className="all_tab_link uk-link" onClick={openAllTab}>
              {chrome.i18n.getMessage('content_msg_all_tab_open')}
            </span>
          </div>
          <div className="uk-width-auto">
            {/* すべてのリンクを閉じるはブロックの削除に等しいため、
                ロック中は無効化する。開く導線は残す */}
            <span
              className="all_tab_delete uk-link"
              // 淡色になるだけでは押せない理由が伝わらないため補う。
              // 無効の見た目はaria-disabledを見てCSS側で付ける
              title={
                locked
                  ? chrome.i18n.getMessage('content_msg_locked_action_disabled')
                  : undefined
              }
              aria-disabled={locked}
              onClick={locked ? undefined : deleteBlock}
            >
              {chrome.i18n.getMessage('content_msg_all_tab_close')}
            </span>
          </div>
          <div className="uk-width-expand" />
        </div>
      </div>
      <div className="uk-card-body" inert={tabsLocked}>
        <ul>
          {block.tabs.map((tab, index) =>
            // urlを持たないタブはリンクとして機能せず、クリックすると
            // 空の新規タブが開いて元のデータが消えるため壊れたタブとして扱う。
            // urlが空文字列のタブ(#192で特定したchrome.tabs.Tab.urlの挙動)は
            // titleが読めるので通常のタブとして表示する
            tab?.url == null ? (
              <BrokenTab
                key={`${index}-broken`}
                deleteClick={() => deleteClick(index)}
                locked={locked}
              />
            ) : (
              // タブ1件の破損でブロックごと落ちると、同じブロックの正常なタブまで
              // 表示されなくなるため、境界はタブ単位に置く。
              // 一次防御は上のurlの明示チェックで、この境界は
              // 想定していない壊れ方（titleが文字列でない等）への保険
              <ErrorBoundary
                key={`${index}-${tab.url}`}
                // urlが変わればkeyごと変わって再マウントされるが、
                // 同じurlのままtitleだけ直ったケースはkeyでは拾えない
                resetKey={tab}
                fallback={
                  <BrokenTab
                    deleteClick={() => deleteClick(index)}
                    locked={locked}
                  />
                }
              >
                <Tab
                  tab={tab}
                  deleteClick={() => deleteClick(index)}
                  editClick={() => startTabEdit(index)}
                  openLinkClick={() => openLink(index)}
                  locked={locked}
                />
              </ErrorBoundary>
            ),
          )}
        </ul>
      </div>
      {editTarget != null && editIndex != null ? (
        <EditTabModal
          // 編集対象が変わったときに前のタブの入力が残らないようにする
          key={editIndex}
          // 表示するのは編集を始めた時点のタブ。propsは入力欄の初期値としてしか
          // 読まれないため、読み直しで入れ替わったタブを渡す意味はない
          tab={editTarget}
          targetLost={editTargetLost}
          onSave={saveEditedTab}
          onCancel={closeTabEdit}
        />
      ) : null}
    </div>
  );
});

Block.displayName = 'Block';

export default Block;

import React, { useEffect, useId, useRef, useState } from 'react';
import { model } from '../types/interface';
import { chromeService } from '../chromeService';
import { openableTab, Tab } from './tab';
import BrokenTab from './brokenTab';
import EditTabModal from './editTabModal';
import { ErrorBoundary } from './errorBoundary';

// 名前の入力欄に入れられる長さの上限。カードの見出しに収まる長さに抑えることと、
// storage.syncの8KB/item制限を名前で圧迫しないことが目的。
// 入力欄のmaxLengthとしてだけ効かせ、インポートしたデータがこれより長い名前を
// 持っていた場合は黙って切り捨てず、そのまま保持する
const BLOCK_TITLE_MAX_LENGTH = 100;

interface BlockProps {
  block: model.Block;
  // storageへの永続化とブロック一覧stateの更新はApp側で行う。
  // 永続化に失敗するとrejectされる（失敗の記録はApp側で済んでいる）
  updateBlock: (newBlock: model.Block) => Promise<void>;
}

// ブロックのstateはAppが所有し、Blockはpropsの表示と操作イベントの発火に徹する。
// memo化により、他ブロック更新時の再レンダリングを避ける
// （updateBlockはApp側でuseCallbackにより参照が安定している前提）
const Block: React.FC<BlockProps> = React.memo((props) => {
  const block = props.block;
  const createdAt = block.createdAt;
  // 編集中のタブのindex。nullなら編集モーダルを出さない
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // 名前の編集中かどうか。編集を始めたときの名前をdraftの初期値にする
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleFieldId = useId();
  const titleHintId = useId();
  const [lockError, setLockError] = useState<string | null>(null);

  // 誤操作からブロックを守るための状態。ロック中は削除・編集の導線を止め、
  // リンクを開いてもタブを一覧から消さない
  const locked = block.locked === true;

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

  // タブ配列の差し替えをApp経由でstorageへ反映する。
  // updateBlockはブロックごと書き戻すため、タブだけを変える導線でも
  // タブ以外のフィールドを引き継がないと保存のたびに消える
  const updateTabs = (tabs: model.Tab[]): Promise<void> =>
    trackTabWrite(
      props.updateBlock({
        ...block,
        tabs: tabs,
      }),
    );

  // 結果を待たない導線用。失敗はApp側でerrorLogに記録済みなので、
  // ここで受けないとunhandled rejectionになるだけ
  const updateTabsIgnoringFailure = (tabs: model.Tab[]): void => {
    updateTabs(tabs).catch(() => {});
  };

  const openLink = (index: number) => {
    const url = block.tabs[index]!.url;
    if (locked) {
      // ロック中は開くだけで一覧から消さない。書き戻しが要らないため
      // 飛行中としても数えない
      chromeService.tab
        .createTabs({ url: url, active: false })
        .catch((error) => {
          chromeService.errorLog.set(error).catch(console.error);
        });
      return;
    }
    // タブを開き終わってから書き戻すまでが1つの操作なので、
    // chrome.tabs.createを待つ間も飛行中として数える
    trackTabWrite(
      chromeService.tab
        .createTabs({ url: url, active: false })
        .then(() => deleteClick(index)),
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
    updateTabsIgnoringFailure(block.tabs.filter((_, i) => i != index));
  };

  // 保存できたときだけモーダルを閉じる。失敗時はrejectをモーダル側へ返し、
  // 入力を残したまま再試行できるようにする
  const saveEditedTab = (index: number, newTab: model.Tab): Promise<void> =>
    updateTabs(block.tabs.map((tab, i) => (i == index ? newTab : tab))).then(
      () => {
        setEditIndex(null);
      },
    );

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
    // 途中で飛行中でなくなると、その隙に名前の編集を始められてしまう
    trackTabWrite(
      Promise.all(
        openTabs.map((tab) =>
          chromeService.tab.createTabs({ url: tab.url, active: false }),
        ),
      ).then(() => {
        // 開いたタブだけを消す。開けなかったタブまでブロックごと消すと、
        // 一覧に見えていたタブが開かれもせず失われる
        updateTabsIgnoringFailure(
          block.tabs.filter((tab) => !openableTab(tab)),
        );
      }),
    ).catch((error) => {
      chromeService.errorLog.set(error).catch(console.error);
    });
  };

  const deleteBlock = () => {
    if (locked) {
      return;
    }
    updateTabsIgnoringFailure([]);
  };

  /**
   * ロックを切り替えてstorageへ反映する。
   * ロックもブロックごと書き戻すため、名前・タブの書き込みと並行すると
   * 後から着地した側が相手の変更を打ち消す。飛行中として数え、
   * 名前を編集している間はボタン側で塞ぐ
   */
  const toggleLock = () => {
    // ボタンのdisabledで塞いでいるが、保護をDOMの属性だけに預けない
    if (tabsWriting || titleEditing || editing) {
      return;
    }
    setLockError(null);
    trackTabWrite(
      props.updateBlock({
        ...block,
        // ロックしていない状態はキーを持たない形で表す（保存側もそう書く）
        locked: locked ? undefined : true,
      }),
    ).catch(() => {
      // App側のアラートはページ最上部に出るためスクロール中は気付けない。
      // 押しても状態が変わらない理由をカード内でも伝える
      setLockError(
        chrome.i18n.getMessage('content_msg_lock_block_save_failed'),
      );
    });
  };

  // Tab側でもロック中は編集アイコンを無効化しているが、モーダルを開く判断は
  // ブロックの状態を持つこちらでも確かめる
  const startTabEdit = (index: number) => {
    if (locked) {
      return;
    }
    setEditIndex(index);
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
      .updateBlock({
        // 編集している間はタブ側の導線を止めてあるので、propsのタブ配列は
        // 編集を始めたときから変わっていない
        ...block,
        title: newTitle.length <= 0 ? undefined : newTitle,
      })
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

  const editingTab = editIndex == null ? null : block.tabs[editIndex];
  // モーダルのオーバーレイはクリックしか遮らず、背後のリンクにはTabキーで
  // 到達できてしまう。編集対象をindexで持っているため、開いている間に
  // このブロックのタブが増減すると別のタブを上書きしたり、後から着地した
  // 保存が消したはずのタブを書き戻したりする。背後を操作不能にして塞ぐ
  // （aria-modalを名乗る以上、支援技術に対しても背後は無効であるべき）
  const editing = editingTab != null && editIndex != null;
  const titleEditing = titleDraft != null;
  // 名前もタブもブロックごと書き戻すため、両者が並行すると後から着地した側が
  // 相手の変更を打ち消す（名前が消える・開いたタブが一覧に戻る）。
  // 飛行中の書き込みはpropsから分からないので、そもそも同時に始められない
  // ようにして塞ぐ。片方向だけでは「タブ操作の最中に名前を保存する」順序が
  // 残るため、名前→タブ（tabsLocked）とタブ→名前（tabsWriting）の両方を止める。
  // 見出しの入力欄自体は編集中も操作できる必要があるので、
  // inertはヘッダ全体ではなく操作リンクの行に付ける
  const tabsLocked = editing || titleEditing;

  return (
    <div className="tabs uk-card-default block-root-dom" ref={cardRoot}>
      <div className="uk-card-header block-card-header" inert={editing}>
        {/* ロックの切り替えはカードの右上に置く。名前の編集や個々のタブの
            操作より上位の、カード全体に効く操作であるため。
            アイコンだけでは何のボタンか分からないので、ホバー用のtitleに
            加えて支援技術向けにaria-labelとaria-pressedでも状態を伝える */}
        <button
          type="button"
          className="uk-link block-lock-toggle"
          data-uk-icon={`icon: ${locked ? 'lock' : 'unlock'}; ratio: 0.9`}
          title={chrome.i18n.getMessage(
            locked ? 'content_msg_unlock_block' : 'content_msg_lock_block',
          )}
          aria-label={chrome.i18n.getMessage(
            locked ? 'content_msg_unlock_block' : 'content_msg_lock_block',
          )}
          aria-pressed={locked}
          // 名前の編集中とタブの書き換え中は、ブロックごとの書き戻しが
          // 打ち消し合うため切り替えさせない
          disabled={tabsWriting || titleEditing}
          onClick={toggleLock}
        />
        {lockError != null ? (
          <p className="uk-text-danger block-lock-error" role="alert">
            {lockError}
          </p>
        ) : null}
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
            {/* 名前を付けるのはこの機能の主導線なので、タブ行のアイコン
                （span）と違ってキーボードから到達できるbutton要素で置く。
                アイコンだけでは何のボタンか分からないため、ホバー用のtitleに
                加えて支援技術向けにaria-labelでも名前を与える */}
            <button
              type="button"
              ref={titleEditButton}
              className="uk-link uk-margin-small-left block-title-edit"
              data-uk-icon="icon: pencil; ratio: 0.9"
              title={chrome.i18n.getMessage('content_msg_edit_block_title')}
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
        <div className="uk-grid" inert={titleEditing}>
          <div className="uk-width-auto">
            <span className="all_tab_link uk-link" onClick={openAllTab}>
              {chrome.i18n.getMessage('content_msg_all_tab_open')}
            </span>
          </div>
          <div className="uk-width-auto">
            {/* すべてのリンクを閉じるはブロックの削除に等しいため、
                ロック中は無効化する。開く導線は残す */}
            <span
              className={`all_tab_delete ${
                locked ? 'tab-action-disabled' : 'uk-link'
              }`}
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
      {editingTab != null && editIndex != null ? (
        <EditTabModal
          // 編集対象が変わったときに前のタブの入力が残らないようにする
          key={editIndex}
          tab={editingTab}
          onSave={(newTab) => saveEditedTab(editIndex, newTab)}
          onCancel={() => setEditIndex(null)}
        />
      ) : null}
    </div>
  );
});

Block.displayName = 'Block';

export default Block;

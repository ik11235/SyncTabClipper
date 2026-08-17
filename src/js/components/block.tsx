import React, { useId, useState } from 'react';
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

  // タブ配列の差し替えをApp経由でstorageへ反映する。
  // updateBlockはブロックごと書き戻すため、タブだけを変える導線でも
  // 名前を引き継がないと保存のたびに名前が消える
  const updateTabs = (tabs: model.Tab[]): Promise<void> =>
    props.updateBlock({
      tabs: tabs,
      indexNum: block.indexNum,
      createdAt: block.createdAt,
      title: block.title,
    });

  // 結果を待たない導線用。失敗はApp側でerrorLogに記録済みなので、
  // ここで受けないとunhandled rejectionになるだけ
  const updateTabsIgnoringFailure = (tabs: model.Tab[]): void => {
    updateTabs(tabs).catch(() => {});
  };

  const openLink = (index: number) => {
    const url = block.tabs[index]!.url;
    chromeService.tab
      .createTabs({ url: url, active: false })
      .then(() => deleteClick(index))
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  };

  const deleteClick = (index: number) => {
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
    Promise.all(
      openTabs.map((tab) =>
        chromeService.tab.createTabs({ url: tab.url, active: false }),
      ),
    )
      .then(() => {
        // 開いたタブだけを消す。開けなかったタブまでブロックごと消すと、
        // 一覧に見えていたタブが開かれもせず失われる
        updateTabsIgnoringFailure(
          block.tabs.filter((tab) => !openableTab(tab)),
        );
      })
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  };

  const deleteBlock = () => {
    updateTabsIgnoringFailure([]);
  };

  const startTitleEdit = () => {
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
    const newTitle = (titleDraft ?? '').trim();
    setTitleError(null);
    setTitleSaving(true);
    props
      .updateBlock({
        // 編集中もタブの増減は起こりうるので、保存する瞬間のpropsから組み立てる
        tabs: block.tabs,
        indexNum: block.indexNum,
        createdAt: block.createdAt,
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

  const editingTab = editIndex == null ? null : block.tabs[editIndex];
  // モーダルのオーバーレイはクリックしか遮らず、背後のリンクにはTabキーで
  // 到達できてしまう。編集対象をindexで持っているため、開いている間に
  // このブロックのタブが増減すると別のタブを上書きしたり、後から着地した
  // 保存が消したはずのタブを書き戻したりする。背後を操作不能にして塞ぐ
  // （aria-modalを名乗る以上、支援技術に対しても背後は無効であるべき）
  const editing = editingTab != null && editIndex != null;
  const titleEditing = titleDraft != null;
  // 名前は編集中もタブの増減で書き戻されうるが、名前をindexなどで参照して
  // いないため、保存時にpropsから読めば取り違えは起きない。一方で保存の
  // 書き込みが競合すると、後から着地した側が相手の変更を打ち消すため、
  // 名前を編集している間はブロックを書き換える導線だけ止める
  // （見出しの入力欄自体は編集中も操作できる必要があるので、
  //   inertはヘッダ全体ではなく操作リンクの行に付ける）
  const tabsLocked = editing || titleEditing;

  return (
    <div className="tabs uk-card-default block-root-dom">
      <div className="uk-card-header" inert={editing}>
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
            <span className="block_title">
              {block.title != null && block.title.length > 0
                ? block.title
                : chrome.i18n.getMessage('content_msg_tab_length', [
                    block.tabs.length,
                  ])}
            </span>
            {/* アイコンだけでは何のボタンか分からないためtitleで補う */}
            <span
              className="uk-link uk-margin-small-left block_title_edit"
              data-uk-icon="icon: pencil; ratio: 0.9"
              title={chrome.i18n.getMessage('content_msg_edit_block_title')}
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
          <span className="uk-margin-small-left block_tab_count">
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
            <span className="all_tab_delete uk-link" onClick={deleteBlock}>
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
              />
            ) : (
              // タブ1件の破損でブロックごと落ちると、同じブロックの正常なタブまで
              // 表示されなくなるため、境界はタブ単位に置く。
              // 一次防御は上のurlの明示チェックで、この境界は
              // 想定していない壊れ方（titleが文字列でない等）への保険
              <ErrorBoundary
                key={`${index}-${tab.url}`}
                fallback={<BrokenTab deleteClick={() => deleteClick(index)} />}
              >
                <Tab
                  tab={tab}
                  deleteClick={() => deleteClick(index)}
                  editClick={() => setEditIndex(index)}
                  openLinkClick={() => openLink(index)}
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

import React, { useState } from 'react';
import { model } from '../types/interface';
import { chromeService } from '../chromeService';
import { openableTab, Tab } from './tab';
import BrokenTab from './brokenTab';
import EditTabModal from './editTabModal';
import { ErrorBoundary } from './errorBoundary';

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

  // タブ配列の差し替えをApp経由でstorageへ反映する
  const updateTabs = (tabs: model.Tab[]): Promise<void> =>
    props.updateBlock({
      tabs: tabs,
      indexNum: block.indexNum,
      createdAt: block.createdAt,
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

  // 編集中にブロックが更新されて対象が消えることがあるため、
  // タブを取り直してから描画する
  const editingTab = editIndex == null ? null : block.tabs[editIndex];

  return (
    <div className="tabs uk-card-default block-root-dom">
      <div className="uk-card-header">
        <h3 className="uk-card-title uk-margin-remove-bottom">
          {chrome.i18n.getMessage('content_msg_tab_length', [
            block.tabs.length,
          ])}
        </h3>
        <p className="uk-text-meta uk-margin-remove-top">
          {chrome.i18n.getMessage('content_msg_created_at')}
          <time dateTime={createdAt.toISOString()}>
            {createdAt.toLocaleString()}
          </time>
        </p>
        <div className="uk-grid">
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
      <div className="uk-card-body">
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
          // 現状はモーダルを閉じずに編集対象が変わる導線がないが、
          // 増えたときに前のタブの入力が残らないようにしておく
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

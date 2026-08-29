import { blockService } from './blockService';
import { chromeService } from './chromeService';

/**
 * service workerではalertが使えないため、エラーをログ出力し、
 * storage.local + actionバッジ経由でtabsページのErrorDisplayに通知する
 * @param {unknown} error 発生したエラー
 */
function handleError(error: unknown): void {
  console.error(error);
  chromeService.errorLog.set(error).catch(console.error);
}

/**
 * アイコンを押したウィンドウの全タブを保存してtabsページを開き、
 * 元のタブを閉じる。tabsページ自身は保存もタブの終了も対象にしない
 * @param {number} windowId アイコンを押したウィンドウのid
 * @return {Promise<void>}
 */
async function saveWindowTabs(windowId: number): Promise<void> {
  const nextIndex = await chromeService.storage.getNextBlockIndex();
  // tabsページ自身は保存も終了もしない。保存対象に含めると一覧の中に
  // 一覧ページへのリンクが並んでしまい、終了対象に含めると
  // 切り替えた直後のtabsページを閉じてしまう。
  // 「現在のウィンドウ」で引き直さずidで指すのは、storageへの書き込みを
  // 待っている間にユーザーが別のウィンドウへ移ると、閉じるウィンドウと
  // tabsページを置くウィンドウが食い違うため
  const currentTabs = (
    await chromeService.tab.queryTabs({
      windowId: windowId,
    })
  ).filter((tab) => !chromeService.tab.isTabsPage(tab));
  // tabsページしか開いていないウィンドウでは保存するものがない。
  // 空のブロックを書くとindexだけ進んで無駄な欠番が増えるため、
  // tabsページへの切り替えだけを行う
  if (currentTabs.length > 0) {
    // タブグループの名前と色を保存に含める(#191)。取得に失敗しても
    // グループなしとして保存を続ける（ここで止めるとタブごと失う）
    const tabGroups = await chromeService.tab.queryTabGroups(windowId);
    const block = blockService.createBlock(
      currentTabs,
      new Date(),
      nextIndex,
      tabGroups,
    );
    await chromeService.storage.setBlock(block);
    await chromeService.storage.setTabLength(nextIndex + 1);
  }
  // このウィンドウのタブはこれから閉じる。別ウィンドウのtabsページを
  // フォーカスするだけで済ませると、最後のタブまで閉じてウィンドウごと消える
  await chromeService.tab.createTabsPageTab(windowId);
  await chromeService.tab.closeTabs(currentTabs);
}

chrome.runtime.onInstalled.addListener(() => {
  chromeService.ContextMenus.recreateMenus().catch(handleError);
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === chromeService.ContextMenus.gotoTabsPageMenuId) {
    // 何も閉じないので、tabsページは開かれている場所のまま見せる。
    // 引き取ると、tabsページ専用に開いているウィンドウを空にしてしまう
    chromeService.tab.createTabsPageTab().catch(handleError);
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId == null) {
    return;
  }
  saveWindowTabs(tab.windowId).catch(handleError);
});

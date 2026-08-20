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
 * 現在のウィンドウの全タブを保存してtabsページを開き、元のタブを閉じる。
 * tabsページ自身は保存もタブの終了も対象にしない
 * @return {Promise<void>}
 */
async function saveCurrentWindowTabs(): Promise<void> {
  const tabLength = await chromeService.storage.getTabLength();
  const tabsPageUrl = chromeService.tab.tabsPageUrl();
  // tabsページ自身は保存も終了もしない。保存対象に含めると一覧の中に
  // 一覧ページへのリンクが並んでしまい、終了対象に含めると
  // 切り替えた直後のtabsページを閉じてしまう
  const currentTabs = (
    await chromeService.tab.queryTabs({
      currentWindow: true,
    })
  ).filter((tab) => tab.url !== tabsPageUrl);
  // tabsページしか開いていないウィンドウでは保存するものがない。
  // 空のブロックを書くとindexだけ進んで無駄な欠番が増えるため、
  // tabsページへの切り替えだけを行う
  if (currentTabs.length > 0) {
    const block = blockService.createBlock(currentTabs, new Date(), tabLength);
    await chromeService.storage.setBlock(block);
    await chromeService.storage.setTabLength(tabLength + 1);
  }
  await chromeService.tab.createTabsPageTab();
  await chromeService.tab.closeTabs(currentTabs);
}

chrome.runtime.onInstalled.addListener(() => {
  chromeService.ContextMenus.createParentMenu();
  chromeService.ContextMenus.createGotoTabsPageMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === chromeService.ContextMenus.gotoTabsPageMenuId) {
    chromeService.tab.createTabsPageTab().catch(handleError);
  }
});

chrome.action.onClicked.addListener(() => {
  saveCurrentWindowTabs().catch(handleError);
});

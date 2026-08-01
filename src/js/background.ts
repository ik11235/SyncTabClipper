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
 * 現在のウィンドウの全タブを保存してtabsページを開き、元のタブを閉じる
 * @return {Promise<void>}
 */
async function saveCurrentWindowTabs(): Promise<void> {
  const tabLength = await chromeService.storage.getTabLength();
  const currentTabs = await chromeService.tab.queryTabs({
    currentWindow: true,
  });
  const block = blockService.createBlock(currentTabs, new Date(), tabLength);
  await chromeService.storage.setBlock(block);
  await chromeService.storage.setTabLength(tabLength + 1);
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

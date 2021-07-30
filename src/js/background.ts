import {blockService} from "./blockService";
import {chromeService} from "./chromeService";

(() => {
  // contextMenusに関する操作
  chrome.contextMenus.removeAll();

  //親メニュー
  const parentId = chrome.contextMenus.create({
    "title": "syncTabClipper",
    "type": "normal",
    "contexts": ["all"],
  });

  chrome.contextMenus.create({
    "title": "tabページを開く",
    "parentId": parentId,
    "type": "normal",
    "contexts": ["all"],
    "onclick": chromeService.tab.createTabsPageTab
  });

  chrome.browserAction.onClicked.addListener(() => {
    chromeService.storage.getTabLength()
      .then(tabLength => {
        chrome.tabs.query({currentWindow: true}, (currentTabs: chrome.tabs.Tab[]) => {
          const block = blockService.createBlock(currentTabs, new Date());

          chromeService.storage.setTabData(tabLength, blockService.deflateBlock(block))
            .then(_ => chromeService.storage.setTabLength(tabLength + 1))
            .then(_ => chromeService.tab.createTabsPageTab())
            .then(_ => chromeService.tab.closeTabs(currentTabs))
            .catch(error => {
              alert(error.message);
            });
        });
      })
      .catch(error => {
        alert(error.message);
      });
  });
})();

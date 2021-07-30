import {blockService} from "./blockService";
import {chromeService} from "./chromeService";

(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chromeService.ContextMenus.createParentMenu();
    chromeService.ContextMenus.createGotoTabsPageMenu();
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

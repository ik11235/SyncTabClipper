import {blockService} from "./blockService";
import {chromeService} from "./chromeService";

(function () {
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
    "onclick": function () {
      // https://gist.github.com/syoichi/3747507
      const url = chrome.runtime.getURL('tabs.html');
      chrome.tabs.create({
        selected: true,
        url: url
      });
    }
  });
}());

chrome.browserAction.onClicked.addListener(function () {
  chromeService.storage.getTabLength().then(tabLength => {
    chrome.tabs.query({currentWindow: true}, function (tabs: chrome.tabs.Tab[]) {
      const block = blockService.createBlock(tabs, new Date());

      chromeService.storage.setTabData(tabLength, blockService.deflateBlock(block)).then(_ => {
        chromeService.storage.setTabLength(tabLength + 1).then(_ => {
          // errorでないときのみタブを閉じる
          chrome.tabs.query({currentWindow: true}, function (tabs) {
            chrome.tabs.create({url: chrome.runtime.getURL('tabs.html')}, function () {
              tabs.forEach(tab => {
                chrome.tabs.remove(tab.id!, function () {
                });
              });
            });
          });
        }).catch(error => {
          alert(error.message);
        })
      }).catch(error => {
        alert(error.message);
      });
    });
  });
});

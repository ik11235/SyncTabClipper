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
  chrome.storage.sync.get([chromeService.storage.getTabLengthKey()], function (result) {
    const tab_length = chromeService.storage.getTabLengthOrZero(result);
    chrome.tabs.query({currentWindow: true}, function (tabs: chrome.tabs.Tab[]) {
      const block = blockService.createBlock(tabs, new Date());

      const key_str = chromeService.storage.getTabKey(tab_length);
      let save_obj: { [key: string]: string; } = {};
      save_obj[key_str] = blockService.deflateBlock(block)
      chrome.storage.sync.set(save_obj, function () {
        const error = chrome.runtime.lastError;
        if (error) {
          alert(error.message);
        } else {
          let set_data: { [key: string]: number; } = {};
          set_data[chromeService.storage.getTabLengthKey()] = tab_length + 1;
          chrome.storage.sync.set(set_data, function () {
            const error = chrome.runtime.lastError;
            if (error) {
              alert(error.message);
            } else {
              // errorでないときのみタブを閉じる
              chrome.tabs.query({currentWindow: true}, function (tabs) {
                chrome.tabs.create({url: chrome.runtime.getURL('tabs.html')}, function () {
                  tabs.forEach(tab => {
                    chrome.tabs.remove(tab.id!, function () {
                    });
                  });
                });
              });
            }
          });
        }
      });
    });
  });
});

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
    "onclick": function (info) {
        // https://gist.github.com/syoichi/3747507
        const url = chrome.runtime.getURL('tabs.html');
        chrome.tabs.create({
            selected: true,
            url: url
        });
    }
});

chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.storage.sync.get(["tab_length"], function (result) {
        const tab_length = gettabLengthOrZero(result);
        chrome.tabs.query({currentWindow: true}, function (tabs) {
            var json = {
                created_at: new Date().getTime(),
                tabs: []
            };
            for (var i = 0; i < tabs.length; i++) {
                const tab_data = {
                    url: tabs[i].url,
                    title: tabs[i].title
                };
                json.tabs.push(tab_data);
            }
            const key_str = `tab_datas_${tab_length}`;
            var save_obj = {};
            save_obj[key_str] = json;
            chrome.storage.sync.set(save_obj, function () {
                var error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                } else {
                    chrome.storage.sync.set({tab_length: tab_length + 1}, function () {
                        var error = chrome.runtime.lastError;
                        if (error) {
                            alert(error.message);
                        } else {
                            // errorでないときのみタブを閉じる
                            chrome.tabs.query({currentWindow: true}, function (tabs) {
                                chrome.tabs.create({url: chrome.runtime.getURL('tabs.html')}, function () {
                                    for (var i = 0; i < tabs.length; i++) {
                                        chrome.tabs.remove(tabs[i].id, function () {
                                        });
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
    });
});

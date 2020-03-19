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

function isEmpty(obj) {
    return !Object.keys(obj).length;
}


chrome.contextMenus.create({
    "title": "サブ２",
    "parentId": parentId,
    "type": "normal",
    "contexts": ["all"],
    "onclick": function (info) {
        alert("クリックされました");
    }
});

chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.storage.sync.get(['tab_datas'], function (result) {
        if (isEmpty(result)) {
            result.tab_datas = [];
        } else {
            result = result.tab_datas;
        }

        var json = {
            created_at: new Date().getTime(),
            tabs: []
        };

        chrome.tabs.query({currentWindow: true}, function (tabs) {
            for (var i = 0; i < tabs.length; i++) {
                const tab_data = {
                    url: tabs[i].url,
                    title: tabs[i].title
                };
                json.tabs.push(tab_data);
            }

            result.tab_datas.push(json);
            chrome.storage.sync.set({'tab_datas': result}, function () {
                chrome.tabs.query({currentWindow: true}, function (tabs) {
                    chrome.tabs.create({url: chrome.runtime.getURL('tabs.html')}, function () {
                        for (var i = 0; i < tabs.length; i++) {
                            chrome.tabs.remove(tabs[i].id, function () {
                            });
                        }
                    });
                });
            });
        });
    });
});

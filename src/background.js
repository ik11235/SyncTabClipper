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
        chrome.storage.sync.set({'tab_data': json}, function () {
        });
    });
});
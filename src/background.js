chrome.contextMenus.removeAll();

//親メニュー
var parentId = chrome.contextMenus.create({
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
        var id = chrome.runtime.id;
        var url = chrome.runtime.getURL('tabs.html');
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
            var tab_data = {
                url: tabs[i].url,
                title: tabs[i].title
            };
            console.log(tab_data);
            json.tabs.push(tab_data);
        }
        console.log('現在開いているタブの数は[' + tabs.length + ']個です');
        console.log(json);
        chrome.storage.sync.set({'tab_data': json}, function () {
        });
    });
});
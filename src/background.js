chrome.contextMenus.removeAll();

//親メニュー
var parentId = chrome.contextMenus.create({
    "title": "syncTabClipper",
    "type": "normal",
    "contexts": ["all"],
});
//サブ１
chrome.contextMenus.create({
    "title": "サブ１",
    "parentId": parentId,
    "type": "normal",
    "contexts": ["all"],
    "onclick": function (info) {
        alert("クリックされました");
    } //ここまでonclick
});
//サブ２
chrome.contextMenus.create({
    "title": "サブ２",
    "parentId": parentId,
    "type": "normal",
    "contexts": ["all"],
    "onclick": function (info) {
        alert("クリックされました");
    } //ここまでonclick
});

chrome.browserAction.onClicked.addListener(function (tab) {
    var json = {
        created_at: new Date(),
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
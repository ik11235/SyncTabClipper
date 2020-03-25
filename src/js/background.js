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
    chrome.storage.sync.get([gettabLengthKey()], function (result) {
        const tab_length = gettabLengthOrZero(result);
        chrome.tabs.query({currentWindow: true}, function (tabs) {
            let json = {
                created_at: toNumber(new Date().getTime()),
                tabs: []
            };
            for (let i = 0; i < tabs.length; i++) {
                const tab_data = {
                    url: tabs[i].url,
                    title: tabs[i].title
                };
                json.tabs.push(tab_data);
            }
            const key_str = getTabKey(tab_length);
            let save_obj = {};
            save_obj[key_str] = JSON.stringify(json);
            chrome.storage.sync.set(save_obj, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                } else {
                    let set_data = {};
                    set_data[gettabLengthKey()] = tab_length + 1;
                    chrome.storage.sync.set(set_data, function () {
                        const error = chrome.runtime.lastError;
                        if (error) {
                            alert(error.message);
                        } else {
                            // errorでないときのみタブを閉じる
                            chrome.tabs.query({currentWindow: true}, function (tabs) {
                                chrome.tabs.create({url: chrome.runtime.getURL('tabs.html')}, function () {
                                    for (let i = 0; i < tabs.length; i++) {
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

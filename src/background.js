chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.tabs.query({currentWindow: true}, function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
            console.log('url:' + tabs[i].url + ' ' + tabs[i].title);
        }
        console.log('現在開いているタブの数は[' + tabs.length + ']個です');
    });
});
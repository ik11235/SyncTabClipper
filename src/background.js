chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.tabs.query({}, function (tabs) {
        console.log('現在開いているタブの数は[' + tabs.length + ']個です');
    });
});
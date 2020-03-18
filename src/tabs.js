window.onload = function () {
    chrome.storage.sync.get(['tab_data'], function (result) {
        console.dir(result);
        var main = document.getElementById('main');
        main.innerHTML = JSON.stringify(result);
    });
};
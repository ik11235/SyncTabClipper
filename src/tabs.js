function getDomein(str) {
    const parser = new URL(str);
    return parser.host;
}

function isEmpty(obj) {
    return !Object.keys(obj).length;
}

function gettabLengthOrZero(result) {
    if (Number.isInteger(result.tab_length)) {
        return result.tab_length;
    } else {
        return 0;
    }
}

function allClear() {
    chrome.storage.sync.clear(function () {
        alert('すべてのデータを削除しました');
    });
}

window.onload = function () {
    const all_clear = document.getElementById('all_clear');
    all_clear.addEventListener('click', allClear);

    chrome.storage.sync.get(["tab_length"], function (result) {
        const tab_length = gettabLengthOrZero(result);
        if (tab_length <= 0) {
            main.insertAdjacentHTML('afterbegin', `<div class="tabs">no item</div>`);
        } else {
            for (var i = 0; i < tab_length; i++) {
                const cnt = i;
                console.log(cnt);

                chrome.storage.sync.get([`tab_datas_${i}`], function (result) {
                    const main = document.getElementById('main');
                    if (!isEmpty(result)) {
                        const tab_datas = result["tab_datas_" + cnt];
                        const tabs = tab_datas.tabs.map(function (page_data) {
                            var domain = getDomein(page_data.url);
                            // target="_blank"じゃなくて、データ削除する→newtab開くの専用関数でもいいかも
                            var str = `<li><img src="http://www.google.com/s2/favicons?domain=${domain}" alt="${page_data.title}"/><a href="${page_data.url}" target="_blank">${page_data.title}</a></li>`;
                            console.log(str);
                            return str;
                        }).join("\n");

                        main.insertAdjacentHTML('afterbegin', `<div class="tabs"><ul>${tabs}</ul></div>`);
                    }
                });
            }
        }
    });
};

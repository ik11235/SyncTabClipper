function getDomein(str) {
    const parser = new URL(str);
    return parser.host;
}

function isEmpty(obj) {
    return !Object.keys(obj).length;
}

window.onload = function () {
    chrome.storage.sync.get(['tab_datas'], function (result) {
        const main = document.getElementById('main');
        if (!isEmpty(result)) {
            const tab_datas =  result.tab_datas;
            console.dir(result);

            const tabs = tab_datas.tab_datas.map(function (tab) {
                const links = tab.tabs.map(function (page_data) {
                    var domain = getDomein(page_data.url);
                    // target="_blank"じゃなくて、データ削除する→newtab開くの専用関数でもいいかも
                    var str = `<li><img src="http://www.google.com/s2/favicons?domain=${domain}" alt="${page_data.title}"/><a href="${page_data.url}" target="_blank">${page_data.title}</a></li>`;
                    console.log(str);
                    return str;
                }).join("\n");
                console.log("links");
                console.log(links);

                return `<ul>${links}</ul>`;
            });
            console.log(tabs);

            main.insertAdjacentHTML('afterbegin', `<div class="tabs">${tabs}</div>`);
            console.dir(result);
        } else {
            main.insertAdjacentHTML('afterbegin', `<div class="tabs">no item</div>`);

        }
    });
};

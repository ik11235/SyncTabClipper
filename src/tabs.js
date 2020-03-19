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

function jsonFromHtml(dom) {
    const created_at = dom.getAttribute("data-created-at");

    var json = {
        created_at: created_at,
        tabs: []
    };

    const linkDoms = dom.getElementsByClassName('tab_link');
    for (var j = 0; j < linkDoms.length; j++) {
        const tab_data = {
            url: linkDoms[j].getAttribute("data-url"),
            title: linkDoms[j].getAttribute("data-title")
        };
        json.tabs.push(tab_data);
    }

    return json;
}

function deleteLink(target) {
    console.dir(target);
    const parentDiv = target.parentNode.parentNode.parentNode;
    //console.dir(parentDiv);
    // 先にsyncに保存済みのデータを消したいがDom→JSONがやりにくくなる
    // いったん、DOM消しを先にする
    const li = target.parentNode;
    li.parentNode.removeChild(li);

    const id = parentDiv.id;
    const json = jsonFromHtml(parentDiv);
    if (json.tabs.length <= 0) {
        chrome.storage.sync.remove(id, function () {
            var error = chrome.runtime.lastError;
            if (error) {
                alert(error.message);
            }
        });
    } else {
        var save_obj = {};
        save_obj[id] = json;
        console.dir(save_obj);
        chrome.storage.sync.set(save_obj, function () {
            var error = chrome.runtime.lastError;
            if (error) {
                alert(error.message);
            }
        });
    }

}

function clickLinkByEventListener() {
    const target = this;
    console.dir(target);
    var url = target.getAttribute("data-url");
    chrome.tabs.create({url: url, active: false}, function () {
        deleteLink(target);
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
                        const created_at = tab_datas.created_at;
                        const tabs = tab_datas.tabs.map(function (page_data) {
                            var domain = getDomein(page_data.url);
                            // target="_blank"じゃなくて、データ削除する→newtab開くの専用関数でもいいかも
                            var str = `<li><img src="https://www.google.com/s2/favicons?domain=${domain}" alt="${page_data.title}"/><a href="#" class="tab_link" data-url="${page_data.url}" data-title="${page_data.title}">${page_data.title}</a></li>`;
                            console.log(str);
                            return str;
                        }).join("\n");

                        main.insertAdjacentHTML('afterbegin', `<div id="tab_datas_${cnt}" class="tabs" data-created-at="${created_at}"><ul>${tabs}</ul></div>`);

                        const linkDoms = main.getElementsByClassName('tab_link');
                        for (var j = 0; j < linkDoms.length; j++) {
                            linkDoms[j].addEventListener('click', clickLinkByEventListener);
                        }
                    }
                });
            }
        }
    });
};

chrome.storage.sync.get( function (result) {console.dir(result)});

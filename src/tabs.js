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
    if (window.confirm('保存したすべてのタブを削除します。よろしいですか？')) {
        chrome.storage.sync.clear(function () {
            alert('すべてのデータを削除しました');
        });
    }
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
    const parentDiv = target.parentNode.parentNode.parentNode.parentNode;
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
            // タブが0になった場合、現在表示中のdomも削除する
            parentDiv.parentNode.removeChild(parentDiv);
        });
    } else {
        var save_obj = {};
        save_obj[id] = json;
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
    var url = target.getAttribute("data-url");
    chrome.tabs.create({url: url, active: false}, function () {
        deleteLink(target);
    });
}

function deleteLinkByEventListener() {
    const target = this;
    deleteLink(target);
}

function setLinkDom(key) {
    return new Promise(function (resolve) {
        chrome.storage.sync.get([key], function (result) {
            const main = document.getElementById('main');
            if (!isEmpty(result)) {
                const tab_datas = result[key];
                const created_at = tab_datas.created_at;
                const tabs = tab_datas.tabs.map(function (page_data) {
                    var domain = getDomein(page_data.url);
                    // target="_blank"じゃなくて、データ削除する→newtab開くの専用関数でもいいかも
                    var str = `<li>
<img src="https://www.google.com/s2/favicons?domain=${domain}" alt="${page_data.title}"/>
<a href="#" class="tab_link" data-url="${page_data.url}" data-title="${page_data.title}">${page_data.title}</a>
<a href="#" class="tab_close"><span class="uk-icon-link" uk-icon="icon: close; ratio: 0.9"></span></a>
</li>`;
                    return str;
                }).join("\n");
                const created_date = new Date(parseInt(created_at));
                const insertHtml = `
<div id="${key}" class="tabs uk-card-default" data-created-at="${created_at}">
<div class="uk-card-header">
<h3 class="uk-card-title uk-margin-remove-bottom">${tab_datas.tabs.length}個のタブ</h3>
<p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="${created_date.toISOString()}">${created_date}</time></p>
</div>
<div class="uk-card-body">
<ul>${tabs}</ul>
</div>
</div>`;
                main.insertAdjacentHTML('afterbegin', insertHtml);

                const linkDoms = main.getElementsByClassName('tab_link');
                for (var j = 0; j < linkDoms.length; j++) {
                    linkDoms[j].addEventListener('click', clickLinkByEventListener);
                }

                const deleteLinkDoms = main.getElementsByClassName('tab_close');
                for (var j = 0; j < deleteLinkDoms.length; j++) {
                    deleteLinkDoms[j].addEventListener('click', deleteLinkByEventListener);
                }

                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}


window.onload = function () {
    const all_clear = document.getElementById('all_clear');
    all_clear.addEventListener('click', allClear);

    chrome.storage.sync.get(["tab_length"], function (result) {
        const tab_length = gettabLengthOrZero(result);
        let promiseArray = [];

        for (var i = 0; i < tab_length; i++) {
            const key = `tab_datas_${i}`;
            promiseArray.push(setLinkDom(key))
        }

        Promise.all(promiseArray).then((result) => {
            const is_tabs_exists = (result.filter(flag => flag === true).length > 0);
            if (!is_tabs_exists) {
                main.insertAdjacentHTML('afterbegin', `
<div class="uk-eader">
<h3 class="uk-title uk-margin-remove-bottom no-tabs">保存済みのタブはありません。</h3></div>
`);
            }
        });
    });
};

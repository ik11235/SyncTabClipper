window.onload = function () {
    const extension_name = chrome.runtime.getManifest().name;
    document.getElementsByTagName("h1")[0].innerHTML = document.getElementsByTagName("h1")[0].innerHTML.replace("SyncTabClipper", extension_name);

    function exportJson() {
        const export_text_dom = document.getElementById("export_body");
        chrome.storage.sync.get([gettabLengthKey()], function (result) {
            const tab_length = gettabLengthOrZero(result);
            let promiseArray = [];

            for (let x = 0; x < tab_length; x++) {
                const key = getTabKey(x);
                promiseArray.push(getSyncStorage(key))
            }

            Promise.all(promiseArray).then((result) => {
                const obj_result = result.filter(Boolean).filter(str => str.toString().length > 0).map(data => JSON.parse(data));

                const sort_result = obj_result.filter(Boolean).filter(data => (data.tabs.length > 0)).sort(function (a, b) {
                    return b.created_at - a.created_at;
                });

                export_text_dom.value = JSON.stringify(sort_result);
            });
        });
    }

    function importJson() {
        const import_text_dom = document.getElementById("import_body");
        const json = JSON.parse(import_text_dom.value);
        (async () => {
            const tab_length_result = await getSyncStorage(gettabLengthKey());
            const tab_length = gettabLengthOrZero(tab_length_result);
            let promiseArray = [];
            let idx = tab_length;
            json.reverse().forEach((json_arr) => {
                const key = getTabKey(idx);
                promiseArray.push(setSyncStorage(key, JSON.stringify(json_arr)));
                idx += 1;
            });

            Promise.all(promiseArray).then(() => {
                let set_data = {};
                set_data[gettabLengthKey()] = tab_length + json.length;
                chrome.storage.sync.set(set_data, function () {
                    chrome.tabs.reload({bypassCache: true}, function () {
                    });
                });
            }).catch(function (reason) {
                alert("データのインポートに失敗しました。" + reason.message);
            });
        })();
    }

    function setLinkDom(key) {
        return new Promise(function (resolve) {
                chrome.storage.sync.get([key], function (result) {
                    const main = document.getElementById('main');
                    if (!isEmpty(result)) {
                        const tab_datas = JSON.parse(result[key]);
                        const created_at = toNumber(tab_datas.created_at);
                        const tabs = tab_datas.tabs.map(function (page_data) {
                            const domain = getDomein(page_data.url);
                            // URLパースに失敗した場合、""を返す
                            // そのままだと、https://www.google.com/s2/faviconsが400になるので、空文字を渡す
                            const encode_domain = (domain === "") ? encodeURI(" ") : encodeURI(domain);
                            const encode_url = escape_html(page_data.url);
                            const encode_title = escape_html(page_data.title);
                            return `
<li>
    <img src="https://www.google.com/s2/favicons?domain=${encode_domain}" alt="${encode_title}"/>
    <a href="${encode_url}" class="tab_link" data-url="${encode_url}" data-title="${encode_title}">${encode_title}</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li>`;
                        }).join("\n");
                        const created_date = new Date(created_at);
                        const insertHtml = `
<div id="${key}" class="tabs uk-card-default" data-created-at="${created_at}">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">${tab_datas.tabs.length}個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="${created_date.toISOString()}">${created_date}</time></p>
        <div class="uk-grid">
            <div class="uk-width-auto"><span class="all_tab_link uk-link">すべてのリンクを開く</span></div>
            <div class="uk-width-auto"><span class="all_tab_delete uk-link">すべてのリンクを閉じる</span></div>
            <div class="uk-width-expand"></div>
        </div>
    </div>
    <div class="uk-card-body">
        <ul>${tabs}</ul>
    </div>
</div>`;
                        main.insertAdjacentHTML('afterbegin', insertHtml);
                        const this_card_dom = document.getElementById(key);

                        const linkDoms = this_card_dom.getElementsByClassName('tab_link');
                        for (let j = 0; j < linkDoms.length; j++) {
                            linkDoms[j].addEventListener('click', function (e) {
                                e.preventDefault();
                                clickLinkByEventListener(e.toElement);
                            });
                        }

                        const deleteLinkDoms = this_card_dom.getElementsByClassName('tab_close');
                        for (let j = 0; j < deleteLinkDoms.length; j++) {
                            deleteLinkDoms[j].addEventListener('click', deleteLinkByEventListener);
                        }

                        const all_tab_link = this_card_dom.getElementsByClassName('all_tab_link')[0];
                        all_tab_link.addEventListener('click', allOpenLinkByEventListener);
                        const all_tab_delete = this_card_dom.getElementsByClassName('all_tab_delete')[0];
                        all_tab_delete.addEventListener('click', allDeleteLinkByEventListener);

                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            }
        );
    }

    function jsonFromHtml(dom) {
        const created_at = toNumber(dom.getAttribute("data-created-at"));

        let json = {
            created_at: created_at,
            tabs: []
        };

        const linkDoms = dom.getElementsByClassName('tab_link');
        for (let j = 0; j < linkDoms.length; j++) {
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
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                }
                // タブが0になった場合、現在表示中のdomも削除する
                parentDiv.parentNode.removeChild(parentDiv);
            });
        } else {
            let save_obj = {};
            save_obj[id] = json;
            chrome.storage.sync.set(save_obj, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                }
            });
        }

    }

    function clickLinkByEventListener(e) {
        const target = e;
        const url = target.getAttribute("data-url");
        chrome.tabs.create({url: url, active: false}, function () {
            deleteLink(target);
        });
    }

    function deleteLinkByEventListener() {
        const target = this;
        deleteLink(target);
    }

    function allOpenLinkByEventListener() {
        const target = this;
        const parentDiv = target.parentNode.parentNode.parentNode.parentNode;
        const tab_links = parentDiv.getElementsByClassName("tab_link");
        let promiseArray = [];
        for (let i = 0; i < tab_links.length; i++) {
            const url = tab_links[i].getAttribute("data-url");
            promiseArray.push(createTabs({url: url, active: false}));
        }
        Promise.all(promiseArray).then(() => {
            allDeleteLink(target);
        });
    }

    function allDeleteLinkByEventListener() {
        const target = this;
        allDeleteLink(target);
    }

    function allDeleteLink(target) {
        const parentDiv = target.parentNode.parentNode.parentNode.parentNode;

        const id = parentDiv.id;
        chrome.storage.sync.remove(id, function () {
            const error = chrome.runtime.lastError;
            if (error) {
                alert(error.message);
            }

            parentDiv.parentNode.removeChild(parentDiv);
        });
    }

    const all_clear = document.getElementById('all_clear');
    all_clear.addEventListener('click', allClear);
    const export_link = document.getElementById('export_link');
    export_link.addEventListener('click', exportJson);
    const import_link = document.getElementById('import_link');
    import_link.addEventListener('click', importJson);

    chrome.storage.sync.get([gettabLengthKey()], function (result) {
        const tab_length = gettabLengthOrZero(result);
        let promiseArray = [];

        for (let i = 0; i < tab_length; i++) {
            const key = getTabKey(i);
            promiseArray.push(setLinkDom(key))
        }

        Promise.all(promiseArray).then((result) => {
            const is_tabs_exists = (result.filter(flag => flag === true).length > 0);
            const main = document.getElementById('main');
            if (!is_tabs_exists) {
                main.insertAdjacentHTML('afterbegin', `
<div class="uk-header">
    <h3 class="uk-title uk-margin-remove-bottom no-tabs">保存済みのタブはありません。</h3>
</div>
`);
            }
        });
    });
}
;

chrome.storage.sync.get(function (result) {
    console.dir(result);
});

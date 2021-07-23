// @ts-ignore
import {deflateJson} from "./util";

// @ts-ignore
import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
UIkit.use(Icons);

const util = require('./util');
require('./uikit.min.js')
require('./uikit-icons.min.js')

window.onload = function () {
    const extension_name = chrome.runtime.getManifest().name;
    // @ts-ignore
    document.getElementsByTagName("h1")[0].innerHTML = document.getElementsByTagName("h1")[0].innerHTML.replace("SyncTabClipper", extension_name);

    function exportJson() {
        const export_text_dom = document.getElementById("export_body");
        chrome.storage.sync.get([util.gettabLengthKey()], function (result) {
            const tab_length = util.gettabLengthOrZero(result);
            let promiseArray = [];

            for (let x = 0; x < tab_length; x++) {
                const key = util.getTabKey(x);
                promiseArray.push(util.getSyncStorage(key))
            }

            Promise.all(promiseArray).then((result) => {
                const obj_result = result.filter(Boolean).filter(str => str.toString().length > 0).map(data => util.inflateJson(data));

                const sort_result = obj_result.filter(Boolean).filter(data => (data.tabs.length > 0)).sort(function (a, b) {
                    return b.created_at - a.created_at;
                });

                // @ts-ignore
                export_text_dom.value = JSON.stringify(sort_result);
            });
        });
    }

    function importJson() {
        const import_text_dom = document.getElementById("import_body");
        // @ts-ignore
        const json = JSON.parse(import_text_dom.value);
        (async () => {
            const tab_length_result = await util.getSyncStorage(util.gettabLengthKey());
            const tab_length = util.gettabLengthOrZero(tab_length_result);
            // @ts-ignore
            let promiseArray = [];
            let idx = tab_length;
            // @ts-ignore
            json.reverse().forEach((json_arr) => {
                const key = util.getTabKey(idx);
                promiseArray.push(util.setSyncStorage(key, util.deflateJson(JSON.stringify(json_arr))));
                idx += 1;
            });

            // @ts-ignore
            Promise.all(promiseArray).then(() => {
                let set_data = {};
                // @ts-ignore
                set_data[util.gettabLengthKey()] = tab_length + json.length;
                chrome.storage.sync.set(set_data, function () {
                    chrome.tabs.reload({bypassCache: true}, function () {
                    });
                });
            }).catch(function (reason) {
                alert("データのインポートに失敗しました。" + reason.message);
            });
        })();
    }

    // @ts-ignore
    function setLinkDom(key) {
        return new Promise(function (resolve) {
                chrome.storage.sync.get([key], function (result) {
                    const main = document.getElementById('main');

                    if (!util.isEmpty(result)) {
                        const tab_datas = util.inflateJson(result[key]);
                        const created_at = util.toNumber(tab_datas.created_at);
                        // @ts-ignore
                        const tabs = tab_datas.tabs.map(function (page_data) {
                            const domain = util.getDomein(page_data.url);
                            // URLパースに失敗した場合、""を返す
                            // そのままだと、https://www.google.com/s2/faviconsが400になるので、空文字を渡す
                            const encode_domain = (domain === "") ? encodeURI(" ") : encodeURI(domain);
                            const encode_url = util.escape_html(page_data.url);
                            const encode_title = util.escape_html(page_data.title);
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
                        // @ts-ignore
                        main.insertAdjacentHTML('afterbegin', insertHtml);
                        const this_card_dom = document.getElementById(key);

                        // @ts-ignore
                        const linkDoms = this_card_dom.getElementsByClassName('tab_link');
                        for (let j = 0; j < linkDoms.length; j++) {
                            // @ts-ignore
                            linkDoms[j].addEventListener('click', function (e) {
                                e.preventDefault();
                                // @ts-ignore
                                clickLinkByEventListener(e.srcElement);
                            });
                        }

                        // @ts-ignore
                        const deleteLinkDoms = this_card_dom.getElementsByClassName('tab_close');
                        for (let j = 0; j < deleteLinkDoms.length; j++) {
                            // @ts-ignore
                            deleteLinkDoms[j].addEventListener('click', deleteLinkByEventListener);
                        }

                        // @ts-ignore
                        const all_tab_link = this_card_dom.getElementsByClassName('all_tab_link')[0];
                        // @ts-ignore
                        all_tab_link.addEventListener('click', allOpenLinkByEventListener);
                        // @ts-ignore
                        const all_tab_delete = this_card_dom.getElementsByClassName('all_tab_delete')[0];
                        // @ts-ignore
                        all_tab_delete.addEventListener('click', allDeleteLinkByEventListener);

                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            }
        );
    }

    // @ts-ignore
    function jsonFromHtml(dom) {
        const created_at = util.toNumber(dom.getAttribute("data-created-at"));

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
            // @ts-ignore
            json.tabs.push(tab_data);
        }

        return json;
    }

    // @ts-ignore
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
            // @ts-ignore
            save_obj[id] = deflateJson(JSON.stringify(json));
            chrome.storage.sync.set(save_obj, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                }
            });
        }

    }

    function clickLinkByEventListener(e: HTMLElement) {
        const target = e;
        const url = target.getAttribute("data-url");
        // @ts-ignore
        chrome.tabs.create({url: url, active: false}, function () {
            deleteLink(target);
        });
    }

    function deleteLinkByEventListener() {
        // @ts-ignore
        const target = this;
        deleteLink(target);
    }

    function allOpenLinkByEventListener() {
        // @ts-ignore
        const target = this;
        const parentDiv = target.parentNode.parentNode.parentNode.parentNode;
        const tab_links = parentDiv.getElementsByClassName("tab_link");
        let promiseArray = [];
        for (let i = 0; i < tab_links.length; i++) {
            const url = tab_links[i].getAttribute("data-url");
            promiseArray.push(util.createTabs({url: url, active: false}));
        }
        Promise.all(promiseArray).then(() => {
            allDeleteLink(target);
        });
    }

    function allDeleteLinkByEventListener() {
        // @ts-ignore
        const target = this;
        allDeleteLink(target);
    }

    // @ts-ignore
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
    // @ts-ignore
    all_clear.addEventListener('click', util.allClear);
    const export_link = document.getElementById('export_link');
    // @ts-ignore
    export_link.addEventListener('click', exportJson);
    const import_link = document.getElementById('import_link');
    // @ts-ignore
    import_link.addEventListener('click', importJson);

    chrome.storage.sync.get([util.gettabLengthKey()], function (result) {
        const tab_length = util.gettabLengthOrZero(result);
        let promiseArray = [];

        for (let i = 0; i < tab_length; i++) {
            const key = util.getTabKey(i);
            promiseArray.push(setLinkDom(key))
        }

        Promise.all(promiseArray).then((result) => {
            const is_tabs_exists = (result.filter(flag => flag === true).length > 0);
            const main = document.getElementById('main');
            if (!is_tabs_exists) {
                // @ts-ignore
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

import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import {blockService} from "./blockService";
// @ts-ignore
UIkit.use(Icons);

const util = require('./util');

window.onload = function () {
    const extension_name = chrome.runtime.getManifest().name;
    // @ts-ignore
    document.getElementsByTagName("h1")[0].innerHTML = document.getElementsByTagName("h1")[0].innerHTML.replace("SyncTabClipper", extension_name);

    function exportJson() {
        const exportTextElement: HTMLInputElement = <HTMLInputElement>document.getElementById('export_body')
        blockService.exportAllDataJson(exportTextElement)
    }

    function importJson() {
        const import_text_dom = document.getElementById("import_body");
        // @ts-ignore
        const json = JSON.parse(import_text_dom.value);
        (async () => {
            const tab_length_result = await util.getSyncStorage(util.getTabLengthKey());
            const tab_length = util.getTabLengthOrZero(tab_length_result);
            let promiseArray: Promise<void>[] = [];
            let idx = tab_length;
            // @ts-ignore
            json.reverse().forEach((json_arr) => {
                const key = util.getTabKey(idx);
                promiseArray.push(util.setSyncStorage(key, util.deflateJson(JSON.stringify(json_arr))));
                idx += 1;
            });

            Promise.all(promiseArray).then(() => {
                let set_data: { [key: string]: number; } = {};
                set_data[util.getTabLengthKey()] = tab_length + json.length;
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
                        const block = blockService.inflateJson(result[key]);
                        const insertHtml = blockService.blockToHtml(block, key);
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
    function deleteLink(target) {
        const parentDiv = target.parentNode.parentNode.parentNode.parentNode;
        // 先にsyncに保存済みのデータを消したいがDom→JSONがやりにくくなる
        // いったん、DOM消しを先にする
        const li = target.parentNode;
        li.parentNode.removeChild(li);

        const id = parentDiv.id;
        const block = blockService.htmlToBlock(parentDiv)
        if (block.tabs.length <= 0) {
            chrome.storage.sync.remove(id, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                }
                // タブが0になった場合、現在表示中のdomも削除する
                parentDiv.parentNode.removeChild(parentDiv);
            });
        } else {
            let save_obj: { [key: string]: string; } = {};
            save_obj[id] = util.deflateJson(blockService.blockToJson(block));
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

    chrome.storage.sync.get([util.getTabLengthKey()], function (result) {
        const tab_length = util.getTabLengthOrZero(result);
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

import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import {blockService} from "./blockService";
import {chromeService} from "./chromeService";
import {util} from "./util"

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
    util.replacePageTitle(<HTMLElement>document.getElementsByTagName("h1")[0], chrome.runtime.getManifest().name)

    function exportJson() {
        const exportTextElement: HTMLInputElement = <HTMLInputElement>document.getElementById('export_body')
        blockService.exportAllDataJson(exportTextElement)
    }

    function importJson() {
        const importTextElement: HTMLInputElement = <HTMLInputElement>document.getElementById("import_body");
        blockService.importAllDataJson(importTextElement.value).catch(error => alert("データのインポートに失敗しました。" + error.message));
    }

    function setLinkDom(key: string): Promise<boolean> {
        return new Promise(function (resolve) {
                chrome.storage.sync.get([key], function (result) {
                    const main = document.getElementById('main')!

                    if (!util.isEmpty(result)) {
                        const block = blockService.inflateJson(result[key]);
                        const insertHtml = blockService.blockToHtml(block, key);
                        main.insertAdjacentHTML('afterbegin', insertHtml);
                        const BlockRootDom = document.getElementById(key)!

                        const linkDoms = BlockRootDom.getElementsByClassName('tab_link');
                        for (const link of linkDoms) {
                            link.addEventListener('click', function (e: Event) {
                                e.preventDefault();
                                clickLinkByEventListener(e);
                            });
                        }

                        const deleteLinkDoms = BlockRootDom.getElementsByClassName('tab_close')
                        for (const link of deleteLinkDoms) {
                            link.addEventListener('click', deleteLinkByEventListener);
                        }

                        const allTabLink = BlockRootDom.getElementsByClassName('all_tab_link')[0]!
                        allTabLink.addEventListener('click', allOpenLinkByEventListener)
                        const allTabDelete = BlockRootDom.getElementsByClassName('all_tab_delete')[0]!
                        allTabDelete.addEventListener('click', allDeleteLinkByEventListener);

                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            }
        );
    }

    function deleteLink(target: HTMLElement): void {
        const BlockRootDom = util.searchBlockRootDom(target)

        // 先にsyncに保存済みのデータを消したいがDom→JSONがやりにくくなる
        // いったん、DOM消しを先にする
        target.parentNode!.removeChild(target);

        const id = BlockRootDom.id;
        const block = blockService.htmlToBlock(BlockRootDom)
        if (block.tabs.length <= 0) {
            chrome.storage.sync.remove(id, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                }
                // タブが0になった場合、現在表示中のdomも削除する
                BlockRootDom.parentNode!.removeChild(BlockRootDom);
            });
        } else {
            let save_obj: { [key: string]: string; } = {};
            save_obj[id] = blockService.deflateBlock(block)
            chrome.storage.sync.set(save_obj, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                }
            });
        }

    }

    function clickLinkByEventListener(e: Event) {
        const target = <HTMLElement>e.target!;
        const url = target.getAttribute("data-url")!
        const tabRootDom = util.searchTabRootDom(target)

        chrome.tabs.create({url: url, active: false}, function () {
            deleteLink(tabRootDom);
        });
    }

    function deleteLinkByEventListener(e: Event): void {
        const target = <HTMLElement>e.target!;
        const tabRootDom = util.searchTabRootDom(target)

        deleteLink(tabRootDom);
    }

    function allOpenLinkByEventListener(e: Event): void {
        const target = <HTMLElement>e.target!;

        const BlockRootDom = util.searchBlockRootDom(target)
        const tab_links = BlockRootDom.getElementsByClassName("tab_link");
        let promiseArray: Promise<void>[] = [];
        for (let tab of tab_links) {
            const url = tab.getAttribute("data-url")!
            promiseArray.push(chromeService.tab.createTabs({url: url, active: false}));
        }
        Promise.all(promiseArray).then(() => {
            allDeleteLink(target);
        });
    }

    function allDeleteLinkByEventListener(e: Event): void {
        const target = <HTMLElement>e.target!;

        allDeleteLink(target);
    }

    function allDeleteLink(target: HTMLElement) {
        const BlockRootDom = util.searchBlockRootDom(target)

        const id = BlockRootDom.id;
        chrome.storage.sync.remove(id, function () {
            const error = chrome.runtime.lastError;
            if (error) {
                alert(error.message);
            }

            BlockRootDom.parentNode!.removeChild(BlockRootDom);
        });
    }

    const all_clear = document.getElementById('all_clear')!
    all_clear.addEventListener('click', chromeService.storage.allClear);
    const export_link = document.getElementById('export_link')!
    export_link.addEventListener('click', exportJson);
    const import_link = document.getElementById('import_link')!
    import_link.addEventListener('click', importJson);

    chrome.storage.sync.get([chromeService.storage.getTabLengthKey()], function (result) {
        const tab_length = chromeService.storage.getTabLengthOrZero(result);
        let promiseArray = [];

        for (let i = 0; i < tab_length; i++) {
            const key = chromeService.storage.getTabKey(i);
            promiseArray.push(setLinkDom(key))
        }

        Promise.all(promiseArray).then((result) => {
            const is_tabs_exists = (result.filter(flag => flag === true).length > 0);
            const main = document.getElementById('main')!
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

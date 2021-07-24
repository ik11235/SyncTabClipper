import * as util from './util';
import {blockService} from "./blockService";

//  manifest_version3から複数ファイルのbackground.scripts指定ができなくなったので、直接importする
importScripts("js/zlib.js");
importScripts("js/zlib-deflate.js");
importScripts("js/zlib-inflate.js");

chrome.runtime.onInstalled.addListener(function () {
    const parentId = "syncTabClipper-ContextMenu01"
    const openMenuId = "syncTabClipper-OpenNew-tab"


    chrome.contextMenus.create({
        id: parentId,
        title: "syncTabClipper",
        type: "normal",
        contexts: ["all"],
    });

    chrome.contextMenus.create({
        id: openMenuId,
        title: "tabページを開く",
        parentId: parentId,
        type: "normal",
        contexts: ["all"],
    });
})

chrome.contextMenus.onClicked.addListener(function (info, tab): void {
    // https://github.com/STRockefeller/MyProgrammingNote/blob/d985df2a7b4cbae0c3b2e4425292c377e429fcdb/My%20Notes/%E7%A8%8B%E5%BC%8F%E5%AD%B8%E7%BF%92%E7%AD%86%E8%A8%98/Web/Chrome%20Extension/Manifest%20Version%203.md#background-service-workers
    switch (info.menuItemId) {
        case "syncTabClipper-OpenNew-tab":
            // https://gist.github.com/syoichi/3747507
            const url = chrome.runtime.getURL('tabs.html');
            console.log(url)
            /*
            chrome.tabs.create({
                selected: true,
                url: url
            });
             */
            break;
    }
});


/*
chrome.runtime.onInstalled.addListener(function () {
    const parentId = "syncTabClipper-ContextMenu01"
    chrome.contextMenus.create({
        "id": parentId,
        "type": "normal",
        "title": "syncTabClipper",
        "contexts": ["all"],
    });

    chrome.contextMenus.create({
        "title": "tabページを開く",
        "parentId": parentId,
        "type": "normal",
        "contexts": ["all"],
        "onclick": function () {
            // https://gist.github.com/syoichi/3747507
            const url = chrome.runtime.getURL('tabs.html');
            chrome.tabs.create({
                selected: true,
                url: url
            });
        }
    });
});

chrome.action.onClicked.addListener(function () {
    chrome.storage.sync.get([util.getTabLengthKey()], function (result) {
        const tab_length = util.getTabLengthOrZero(result);
        chrome.tabs.query({currentWindow: true}, function (tabs: chrome.tabs.Tab[]) {
            const block = blockService.createBlock(tabs, new Date());

            const key_str = util.getTabKey(tab_length);
            let save_obj: { [key: string]: string; } = {};
            save_obj[key_str] = util.deflateJson(blockService.blockToJson(block));
            chrome.storage.sync.set(save_obj, function () {
                const error = chrome.runtime.lastError;
                if (error) {
                    alert(error.message);
                } else {
                    let set_data: { [key: string]: number; } = {};
                    set_data[util.getTabLengthKey()] = tab_length + 1;
                    chrome.storage.sync.set(set_data, function () {
                        const error = chrome.runtime.lastError;
                        if (error) {
                            alert(error.message);
                        } else {
                            // errorでないときのみタブを閉じる
                            chrome.tabs.query({currentWindow: true}, function (tabs) {
                                chrome.tabs.create({url: chrome.runtime.getURL('tabs.html')}, function () {
                                    tabs.forEach(tab => {
                                        chrome.tabs.remove(tab.id!, function () {
                                        });
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });
    });
});
*/
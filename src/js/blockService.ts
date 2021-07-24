import {model} from "./types/interface";
import * as util from "./util"

export namespace blockService {
    export function createBlock(tabs: chrome.tabs.Tab[], created_at: Date): model.Block {
        let blockTabs: model.Tab[] = []

        tabs.forEach(tab => {
            const tab_data: model.Tab = {
                url: tab.url!,
                title: tab.title!,
            }
            blockTabs.push(tab_data);
        });

        return {
            created_at: created_at,
            tabs: blockTabs
        };
    }

    export function blockToJson(block: model.Block): string {
        let a = {
            // 既存のcreated_atがgetTimeで渡した数字を入れている(互換性) & 文字列としてTimeの方が短いため、Json上ではTimeを入れる
            created_at: block.created_at.getTime(),
            tabs: block.tabs
        }

        return JSON.stringify(a);
    }

    export function jsonToBlock(json: string): model.Block {
        let js = JSON.parse(json);

        const tabs: model.Tab[] = []

        js.tabs.forEach((json_arr: any) => {
            tabs.push({
                url: json_arr.url,
                title: json_arr.title,
            });
        });

        return {
            created_at: new Date(js.created_at),
            tabs: tabs,
        }
    }

    export function inflateJson(jsonStr: string): model.Block {
        try {
            return jsonToBlock(jsonStr);
        } catch (e) {
            if (e instanceof SyntaxError) {
                const jsonStr2 = util.inflate(jsonStr);
                return jsonToBlock(jsonStr2);
            } else {
                throw e;
            }
        }
    }

    export function tabToHtml(tab: model.Tab): string {
        const domain = util.getDomain(tab.url);
        // URLパースに失敗した場合、""を返す
        // そのままだと、https://www.google.com/s2/faviconsが400になるので、空文字を渡す
        const encode_domain = (domain === "") ? encodeURI(" ") : encodeURI(domain);
        const encode_url = util.escape_html(tab.url);
        const encode_title = util.escape_html(tab.title);
        return `
<li>
    <img src="https://www.google.com/s2/favicons?domain=${encode_domain}" alt="${encode_title}"/>
    <a href="${encode_url}" class="tab_link" data-url="${encode_url}" data-title="${encode_title}">${encode_title}</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li>`;
    }

    export function blockToHtml(block: model.Block, id: string): string {
        const created_at = block.created_at;
        const tabs = block.tabs.map(tab => tabToHtml(tab)).join("\n");
        return `
<div id="${id}" class="tabs uk-card-default" data-created-at="${created_at.getTime()}">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">${block.tabs.length}個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="${created_at.toISOString()}">${created_at}</time></p>
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
    }

    export function htmlToBlock(htmldom: HTMLElement): model.Block {
        const meyBeCreatedAtElement = htmldom.getAttribute("data-created-at")
        if (meyBeCreatedAtElement === null) {
            throw "data-created-at is null."
        }

        const created_at = new Date(util.toNumber(meyBeCreatedAtElement))

        let tabs: model.Tab[] = []
        const linkDoms = htmldom.getElementsByClassName('tab_link')!
        for (let j = 0; j < linkDoms.length; j++) {
            const nowDom = linkDoms[j]
            if (nowDom === undefined) {
                throw "nowDom undefined."

            }
            const url = nowDom.getAttribute("data-url")
            const title = nowDom.getAttribute("data-title")
            if (url === null || title === null) {
                throw "data-url or data-title is null."
            }

            tabs.push({
                url: url,
                title: title,
            });
        }

        return {
            created_at: created_at,
            tabs: tabs
        };
    }
}

import {model} from "./types/interface";

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
}

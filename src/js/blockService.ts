import {model} from "./types/interface";

export namespace blockService {
    export function createBlock(tabs: chrome.tabs.Tab[], created_at: Date) {
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
}

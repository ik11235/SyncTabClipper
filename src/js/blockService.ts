import {model} from "./types/interface";
import {zlibWrapper} from "./zlib-wrapper";
import {chromeService} from "./chromeService";

export namespace blockService {
  export function createNewBlock(tabs: chrome.tabs.Tab[], created_at: Date, index: number): model.NewBlock {
    let blockTabs: model.Tab[] = []

    tabs.forEach(tab => {
      const tab_data: model.Tab = {
        url: tab.url!,
        title: tab.title!,
      }
      blockTabs.push(tab_data);
    });

    return {
      indexNum: index,
      created_at: created_at,
      tabs: blockTabs
    };

  }

  function newBlockToJsonObj(block: model.NewBlock): object {
    return {
      created_at: block.created_at.getTime(),
      tabs: block.tabs
    }
  }


  function blockToJsonObjToBlock(object: any, index: number): model.NewBlock {
    return {
      indexNum: index,
      created_at: new Date(object.created_at),
      tabs: object.tabs
    }
  }

  export function newBlockToJson(block: model.NewBlock): string {
    return JSON.stringify(newBlockToJsonObj(block));
  }


  export function jsonToBlock(json: string, indexNum: number): model.NewBlock {
    let js = JSON.parse(json);

    const tabs: model.Tab[] = []

    js.tabs.forEach((json_arr: any) => {
      tabs.push({
        url: json_arr.url,
        title: json_arr.title,
      });
    });

    return {
      indexNum: indexNum,
      created_at: new Date(js.created_at),
      tabs: tabs,
    }
  }

  export function inflateJson(jsonStr: string, indexNum: number): model.NewBlock {
    try {
      return jsonToBlock(jsonStr, indexNum);
    } catch (e) {
      if (e instanceof SyntaxError) {
        const jsonStr2 = zlibWrapper.inflate(jsonStr);
        return jsonToBlock(jsonStr2, indexNum);
      } else {
        throw e;
      }
    }
  }

  export function deflateBlock(block: model.NewBlock): string {
    const blockStr = newBlockToJson(block)
    const deflateStr = zlibWrapper.deflate(blockStr);
    if (deflateStr.length < blockStr.length) {
      return deflateStr;
    } else {
      return blockStr;
    }
  }

  export function exportAllDataJson(targetElement: HTMLInputElement): void {
    chromeService.storage.getAllNewBlock().then(blocks => {
      targetElement.value = JSON.stringify(blocks.map(newBlockToJsonObj));
    });
  }

  function blockListForJsonObject(json: object[], startIndex: number): model.NewBlock[] {
    let idx = startIndex
    return json.map(obj => {
      const o = blockToJsonObjToBlock(obj, idx)
      idx += 1
      return o
    })
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
    let promiseArray: Promise<void>[] = [];
    let idx = tabLength;

    const json = JSON.parse(jsonStr)
    const blocks = blockListForJsonObject(json, idx)

    blocks.forEach(block => {
      promiseArray.push(chromeService.storage.setBlock(block))
    })

    Promise.all(promiseArray).then(() => {
      chromeService.storage.setTabLength(tabLength + json.length).then(_ => {
        chrome.tabs.reload({bypassCache: true});
      }).catch(function (reason) {
        throw reason
      });
    });
  }
}

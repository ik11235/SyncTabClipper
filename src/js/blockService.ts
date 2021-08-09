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

  function blockToJsonObj(block: model.Block): object {
    return {
      created_at: block.created_at.getTime(),
      tabs: block.tabs
    }
  }

  function newBlockToJsonObj(block: model.NewBlock): object {
    return {
      created_at: block.created_at.getTime(),
      tabs: block.tabs
    }
  }


  function blockToJsonObjToBlock(object: any): model.Block {
    return {
      created_at: new Date(object.created_at),
      tabs: object.tabs
    }
  }

  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
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
        const jsonStr2 = zlibWrapper.inflate(jsonStr);
        return jsonToBlock(jsonStr2);
      } else {
        throw e;
      }
    }
  }

  export function deflateBlock(block: model.Block): string {
    const blockStr = blockToJson(block)
    const deflateStr = zlibWrapper.deflate(blockStr);
    if (deflateStr.length < blockStr.length) {
      return deflateStr;
    } else {
      return blockStr;
    }
  }

  const sortBlock = (a: model.Block, b: model.Block): number => {
    return b.created_at.getTime() - a.created_at.getTime()
  }

  export function exportAllDataJson(targetElement: HTMLInputElement): void {
    chromeService.storage.getAllNewBlock().then(blocks => {
      targetElement.value = JSON.stringify(blocks.map(newBlockToJsonObj));
    });
  }

  function blockListForJsonObject(json: object[]): model.Block[] {
    return json.map(blockToJsonObjToBlock)
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
    let promiseArray: Promise<void>[] = [];
    let idx = tabLength;

    const json = JSON.parse(jsonStr)
    const blocks = blockListForJsonObject(json)

    blocksSort(blocks).reverse().forEach(block => {
      promiseArray.push(chromeService.storage.setTabData(idx, deflateBlock(block)))
      idx += 1
    })

    Promise.all(promiseArray).then(() => {
      chromeService.storage.setTabLength(tabLength + json.length).then(_ => {
        chrome.tabs.reload({bypassCache: true});
      }).catch(function (reason) {
        throw reason
      });
    });
  }

  export function blocksSort(blocks: model.Block[]): model.Block[] {
    return blocks.sort(sortBlock);
  }
}

import { model } from './types/interface';
import { zlibWrapper } from './zlib-wrapper';
import { chromeService } from './chromeService';

export namespace blockService {
  // 保存データ・エクスポートJSONのスキーマ版数
  // バージョン情報を持たない従来形式を暗黙のv1とみなし、v2からフィールドを付与する
  export const CURRENT_SCHEMA_VERSION = 2;

  export function createBlock(
    tabs: chrome.tabs.Tab[],
    createdAt: Date,
    index: number,
  ): model.Block {
    const blockTabs: model.Tab[] = [];

    tabs.forEach((tab) => {
      const tabData: model.Tab = {
        url: tab.url!,
        title: tab.title!,
      };
      blockTabs.push(tabData);
    });

    return {
      indexNum: index,
      createdAt: createdAt,
      tabs: blockTabs,
    };
  }

  function blockToJsonObj(block: model.Block): object {
    return {
      created_at: block.createdAt.getTime(),
      tabs: block.tabs,
    };
  }

  // エクスポート/ストレージJSONのブロック表現（v2エンベロープのフィールドを含む）
  type BlockJson = {
    created_at: number;
    tabs: model.Tab[];
    v?: number;
    d?: string;
  };

  function jsonObjToBlock(object: BlockJson, index: number): model.Block {
    return {
      indexNum: index,
      createdAt: new Date(object.created_at),
      tabs: object.tabs,
    };
  }

  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
  }

  export function jsonToBlock(json: string, indexNum: number): model.Block {
    const js = JSON.parse(json) as BlockJson;

    const tabs: model.Tab[] = [];

    js.tabs.forEach((jsonArr) => {
      tabs.push({
        url: jsonArr.url,
        title: jsonArr.title,
      });
    });

    return {
      indexNum: indexNum,
      createdAt: new Date(js.created_at),
      tabs: tabs,
    };
  }

  export function inflateJson(jsonStr: string, indexNum: number): model.Block {
    let js: BlockJson;
    try {
      js = JSON.parse(jsonStr);
    } catch (e) {
      if (e instanceof SyntaxError) {
        // v1の圧縮データは素のzlib+base64文字列でJSONとして解釈できない
        return jsonToBlock(zlibWrapper.inflate(jsonStr), indexNum);
      } else {
        throw e;
      }
    }
    // vフィールドを持たない従来形式は暗黙のv1
    const version = js.v ?? 1;
    switch (version) {
      case 1:
        // v1の非圧縮はブロックJSONそのもの
        return jsonObjToBlock(js, indexNum);
      case 2:
        // v2は圧縮時のみエンベロープ形式({v, ev, d})になる
        return js.d == null
          ? jsonObjToBlock(js, indexNum)
          : jsonToBlock(zlibWrapper.inflate(js.d), indexNum);
      default:
        throw new Error(`Unsupported data version: v=${version}`);
    }
  }

  export function deflateBlock(block: model.Block): string {
    // 圧縮アルゴリズムの変更に備え、バージョン情報は圧縮ペイロードの外側に置く
    const version = {
      v: CURRENT_SCHEMA_VERSION,
      ev: chromeService.runtime.getExtensionVersion(),
    };
    const blockStr = JSON.stringify({ ...version, ...blockToJsonObj(block) });
    const deflateStr = JSON.stringify({
      ...version,
      d: zlibWrapper.deflate(blockToJson(block)),
    });
    if (deflateStr.length < blockStr.length) {
      return deflateStr;
    } else {
      return blockStr;
    }
  }

  export function exportAllDataJson(
    targetElement: HTMLInputElement,
  ): Promise<void> {
    return chromeService.storage.getAllBlock().then((blocks) => {
      targetElement.value = JSON.stringify({
        v: CURRENT_SCHEMA_VERSION,
        ev: chromeService.runtime.getExtensionVersion(),
        blocks: blocks.map(blockToJsonObj),
      });
    });
  }

  function blockListForJsonObject(
    json: BlockJson[],
    startIndex: number,
  ): model.Block[] {
    let idx = startIndex;
    return json.map((obj) => {
      const o = jsonObjToBlock(obj, idx);
      idx += 1;
      return o;
    });
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
    const promiseArray: Promise<void>[] = [];
    const idx = tabLength;

    const json = JSON.parse(jsonStr);
    let blockObjs: BlockJson[];
    if (Array.isArray(json)) {
      // v1のエクスポートはブロックの素の配列
      blockObjs = json;
    } else {
      switch (json.v) {
        case 2:
          blockObjs = json.blocks;
          break;
        default:
          throw new Error(`Unsupported data version: v=${json.v}`);
      }
    }
    const blocks = blockListForJsonObject(blockObjs, idx);

    blocks.forEach((block) => {
      promiseArray.push(chromeService.storage.setBlock(block));
    });

    await Promise.all(promiseArray);
    await chromeService.storage.setTabLength(tabLength + blockObjs.length);
    chrome.tabs.reload({ bypassCache: true });
  }
}

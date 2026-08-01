import { model } from './types/interface';
import { zlibWrapper } from './zlib-wrapper';
import { chromeService } from './chromeService';

export namespace blockService {
  // 保存データ・エクスポートJSONのスキーマ版数
  // バージョン情報を持たない従来形式を暗黙のv1とみなし、v2からフィールドを付与する
  export const CURRENT_SCHEMA_VERSION = 2;

  // eslint-disable-next-line require-jsdoc
  export function createBlock(
    tabs: chrome.tabs.Tab[],
    createdAt: Date,
    index: number
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

  // eslint-disable-next-line require-jsdoc
  function blockToJsonObj(block: model.Block): object {
    return {
      created_at: block.createdAt.getTime(),
      tabs: block.tabs,
    };
  }

  // eslint-disable-next-line require-jsdoc
  function jsonObjToBlock(object: any, index: number): model.Block {
    return {
      indexNum: index,
      createdAt: new Date(object.created_at),
      tabs: object.tabs,
    };
  }

  // eslint-disable-next-line require-jsdoc
  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
  }

  // eslint-disable-next-line require-jsdoc
  export function jsonToBlock(json: string, indexNum: number): model.Block {
    const js = JSON.parse(json);

    const tabs: model.Tab[] = [];

    js.tabs.forEach((jsonArr: any) => {
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

  // eslint-disable-next-line require-jsdoc
  export function inflateJson(jsonStr: string, indexNum: number): model.Block {
    let js: any;
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
    if (js.d == null) {
      if (js.v == null || js.v === CURRENT_SCHEMA_VERSION) {
        // 非圧縮のブロックJSON(vフィールドを持たないv1も構造は同じ)
        return jsonObjToBlock(js, indexNum);
      }
      throw new Error(`Unsupported data version: v=${js.v}`);
    }
    if (js.v === CURRENT_SCHEMA_VERSION) {
      return jsonToBlock(zlibWrapper.inflate(js.d), indexNum);
    }
    throw new Error(`Unsupported data version: v=${js.v}`);
  }

  // eslint-disable-next-line require-jsdoc
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

  // eslint-disable-next-line require-jsdoc
  export function exportAllDataJson(
    targetElement: HTMLInputElement
  ): Promise<void> {
    return chromeService.storage.getAllBlock().then((blocks) => {
      targetElement.value = JSON.stringify({
        v: CURRENT_SCHEMA_VERSION,
        ev: chromeService.runtime.getExtensionVersion(),
        blocks: blocks.map(blockToJsonObj),
      });
    });
  }

  // eslint-disable-next-line require-jsdoc
  function blockListForJsonObject(
    json: object[],
    startIndex: number
  ): model.Block[] {
    let idx = startIndex;
    return json.map((obj) => {
      const o = jsonObjToBlock(obj, idx);
      idx += 1;
      return o;
    });
  }

  // eslint-disable-next-line require-jsdoc
  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
    const promiseArray: Promise<void>[] = [];
    const idx = tabLength;

    const json = JSON.parse(jsonStr);
    let blockObjs: object[];
    if (Array.isArray(json)) {
      // v1のエクスポートはブロックの素の配列
      blockObjs = json;
    } else if (json.v === CURRENT_SCHEMA_VERSION) {
      blockObjs = json.blocks;
    } else {
      throw new Error(`Unsupported data version: v=${json.v}`);
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

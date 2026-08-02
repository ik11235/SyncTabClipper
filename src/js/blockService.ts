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
    const blockTabs: model.Tab[] = tabs.map((tab) => ({
      url: tab.url!,
      title: tab.title!,
    }));

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

  /**
   * JSONとしてparseできただけのデータがBlockとして描画可能かを検証する。
   * ここで弾かないと、created_atやtabsが欠けたデータが描画時まで生き残り、
   * 一覧全体のレンダリングを落とす。呼び出し側がブロック単位で
   * スキップできるよう、不正な場合は例外を投げる
   * @param {unknown} object 検証対象のパース済みJSON
   * @throws {Error} Blockとして解釈できない場合
   */
  function assertBlockJson(object: unknown): asserts object is BlockJson {
    if (object == null || typeof object !== 'object' || Array.isArray(object)) {
      throw new Error('Invalid block data: not an object');
    }
    const { created_at: createdAt, tabs } = object as {
      created_at?: unknown;
      tabs?: unknown;
    };
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
      throw new Error('Invalid block data: created_at is not a finite number');
    }
    if (!Array.isArray(tabs)) {
      throw new Error('Invalid block data: tabs is not an array');
    }
    for (const tab of tabs) {
      if (
        tab == null ||
        typeof tab !== 'object' ||
        typeof (tab as model.Tab).url !== 'string' ||
        typeof (tab as model.Tab).title !== 'string'
      ) {
        throw new Error('Invalid block data: tabs contains an invalid entry');
      }
    }
  }

  function jsonObjToBlock(object: BlockJson, index: number): model.Block {
    assertBlockJson(object);
    return {
      indexNum: index,
      createdAt: new Date(object.created_at),
      tabs: object.tabs.map((tab) => ({ url: tab.url, title: tab.title })),
    };
  }

  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
  }

  export function jsonToBlock(json: string, indexNum: number): model.Block {
    return jsonObjToBlock(JSON.parse(json) as BlockJson, indexNum);
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
    // vフィールドを持たない従来形式は暗黙のv1。
    // jsがnullなど非オブジェクトの場合もjsonObjToBlock側の検証で弾く
    const version = js?.v ?? 1;
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

  export function exportAllDataJson(): Promise<string> {
    return chromeService.storage.getAllBlock().then((blocks) =>
      JSON.stringify({
        v: CURRENT_SCHEMA_VERSION,
        ev: chromeService.runtime.getExtensionVersion(),
        blocks: blocks.map(blockToJsonObj),
      }),
    );
  }

  function blockListForJsonObject(
    json: BlockJson[],
    startIndex: number,
  ): model.Block[] {
    return json.map((obj, i) => jsonObjToBlock(obj, startIndex + i));
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
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

    await Promise.all(
      blocks.map((block) => chromeService.storage.setBlock(block)),
    );
    await chromeService.storage.setTabLength(tabLength + blockObjs.length);
    chrome.tabs.reload({ bypassCache: true });
  }
}

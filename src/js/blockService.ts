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

  /**
   * 一覧の要素が復元できなかったブロックかを判定する
   * @param {model.BlockEntry} entry 判定する要素
   * @return {boolean} 復元できなかったブロックならtrue
   */
  export function isBrokenBlock(
    entry: model.BlockEntry,
  ): entry is model.BrokenBlock {
    return 'broken' in entry;
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
   * 保存データのcreated_atをDateに変換する。
   * Dateとして解釈できない値（Dateの表現範囲±8.64e15を超える数値など）は
   * エポックにフォールバックする。Invalid Dateのまま扱うと
   * block.tsxのtoISOString()がRangeErrorになり、ソートの比較関数もNaNで
   * 非一貫になるため。作成日が壊れていてもタブ自体は読めるので捨てない
   * @param {number} createdAt 保存されていたcreated_at
   * @return {Date} 作成日。解釈できない場合はエポック
   */
  function toCreatedAt(createdAt: number): Date {
    // 数値以外（数値文字列など）はnew Dateの解釈に委ね、
    // Invalid Dateになるものだけをエポックに寄せる
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function jsonObjToBlock(object: BlockJson, index: number): model.Block {
    return {
      indexNum: index,
      createdAt: toCreatedAt(object.created_at),
      tabs: object.tabs,
    };
  }

  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
  }

  export function jsonToBlock(json: string, indexNum: number): model.Block {
    const js = JSON.parse(json) as BlockJson;

    const tabs: model.Tab[] = js.tabs.map((jsonArr) => ({
      url: jsonArr.url,
      title: jsonArr.title,
    }));

    return {
      indexNum: indexNum,
      createdAt: toCreatedAt(js.created_at),
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

  export function exportAllDataJson(): Promise<string> {
    return chromeService.storage.getAllBlock().then((entries) => {
      // 復元できなかったブロックはブロックJSONに戻せないため出力できない
      const blocks = entries.flatMap((entry) =>
        isBrokenBlock(entry) ? [] : [blockToJsonObj(entry)],
      );
      const brokenCount = entries.length - blocks.length;
      if (brokenCount > 0) {
        // 欠けたバックアップを完全なものと誤解して全データ削除に進むのを防ぐ。
        // 通知の失敗でエクスポート自体を失敗させない
        chromeService.errorLog
          .set(
            chrome.i18n.getMessage('content_msg_export_broken_block', [
              brokenCount,
            ]),
          )
          .catch(console.error);
      }
      return JSON.stringify({
        v: CURRENT_SCHEMA_VERSION,
        ev: chromeService.runtime.getExtensionVersion(),
        blocks: blocks,
      });
    });
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
    // 1件でも書き込めないブロックが混ざっていると、一部だけ書き込まれた状態で
    // setTabLengthに到達せず、書き込んだブロックが一覧に出ないまま
    // 次回保存で上書きされる。スキーマ由来のものは書き込む前にまとめて弾く。
    // 書き込み自体の失敗（8KB制限超過など）による部分書き込みは別課題
    if (!Array.isArray(blockObjs)) {
      throw new Error('Invalid data: blocks is not an array');
    }
    if (blockObjs.some((obj) => !Array.isArray(obj?.tabs))) {
      throw new Error('Invalid data: block has no tabs array');
    }
    const blocks = blockListForJsonObject(blockObjs, idx);

    await Promise.all(
      blocks.map((block) => chromeService.storage.setBlock(block)),
    );
    await chromeService.storage.setTabLength(tabLength + blockObjs.length);
    chrome.tabs.reload({ bypassCache: true });
  }
}

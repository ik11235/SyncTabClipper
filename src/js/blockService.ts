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
      // 読み込みが確定していないタブ（セッション復元直後や遅延読み込み中）の
      // urlは空文字列になりうる。空のまま保存すると開き直せないタブになるため、
      // 遷移予定のURLであるpendingUrlへフォールバックする
      url: tab.url || tab.pendingUrl || '',
      title: tab.title ?? '',
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
  // tabsの要素は要素単位で検証・取捨するため、この時点ではunknownのまま扱う
  type BlockJson = {
    created_at: number;
    tabs: unknown[];
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
    // Number.isFiniteだけではDateの表現範囲(±8.64e15)を超える値を通してしまい、
    // Invalid Dateのまま描画時のtoISOString()でRangeErrorになる
    if (
      typeof createdAt !== 'number' ||
      Number.isNaN(new Date(createdAt).getTime())
    ) {
      throw new Error(
        'Invalid block data: created_at is not a valid timestamp',
      );
    }
    if (!Array.isArray(tabs)) {
      throw new Error('Invalid block data: tabs is not an array');
    }
  }

  /**
   * tabs配列からTabとして解釈できる要素だけを取り出す。
   * タブ1件の破損でブロックごと捨てると、同じブロックの正常なタブまで
   * 一覧とエクスポートから消えるため、壊れた要素だけを落としてブロックは残す
   * @param {unknown[]} tabs 検証対象のtabs配列
   * @return {model.Tab[]} Tabとして解釈できた要素のみの配列
   */
  function pickValidTabs(tabs: unknown[]): model.Tab[] {
    const validTabs = tabs.flatMap((tab): model.Tab[] => {
      if (tab == null || typeof tab !== 'object') {
        return [];
      }
      const { url, title } = tab as { url?: unknown; title?: unknown };
      // urlのないタブは開き直せず残す意味がない。
      // 一方titleは欠けても開けるので空文字列で補う
      if (typeof url !== 'string') {
        return [];
      }
      return [{ url: url, title: typeof title === 'string' ? title : '' }];
    });
    if (validTabs.length !== tabs.length) {
      console.warn(
        `Skipped ${tabs.length - validTabs.length} invalid tab(s) in a block`,
      );
    }
    return validTabs;
  }

  function jsonObjToBlock(object: unknown, index: number): model.Block {
    assertBlockJson(object);
    return {
      indexNum: index,
      createdAt: new Date(object.created_at),
      tabs: pickValidTabs(object.tabs),
    };
  }

  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
  }

  export function jsonToBlock(json: string, indexNum: number): model.Block {
    return jsonObjToBlock(JSON.parse(json), indexNum);
  }

  export function inflateJson(jsonStr: string, indexNum: number): model.Block {
    let js: unknown;
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
    const envelope =
      js != null && typeof js === 'object'
        ? (js as { v?: unknown; d?: unknown })
        : {};
    const version = envelope.v ?? 1;
    switch (version) {
      case 1:
        // v1の非圧縮はブロックJSONそのもの
        return jsonObjToBlock(js, indexNum);
      case 2:
        // v2は圧縮時のみエンベロープ形式({v, ev, d})になる
        if (envelope.d == null) {
          return jsonObjToBlock(js, indexNum);
        }
        if (typeof envelope.d !== 'string') {
          throw new Error('Invalid block data: d is not a string');
        }
        return jsonToBlock(zlibWrapper.inflate(envelope.d), indexNum);
      default:
        throw new Error(`Unsupported data version: v=${String(version)}`);
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

  /**
   * バックアップに含められなかったブロックがあることをユーザーへ通知する。
   * 通知に失敗してもエクスポート自体は成功させる。
   * ユーザー自身の操作に対する結果なので、getAllBlockの通知と違い
   * 先行エラーがあっても上書きする（黙って完全なバックアップだと
   * 誤解させるほうが害が大きい）
   * @param {string[]} brokenKeys 復元に失敗したブロックのstorage key
   * @return {Promise<void>}
   */
  async function notifyExportBrokenBlocks(brokenKeys: string[]): Promise<void> {
    try {
      await chromeService.errorLog.set(
        chrome.i18n.getMessage('content_msg_export_broken_block', [
          brokenKeys.join(', '),
        ]),
      );
    } catch (e) {
      console.error(e);
    }
  }

  export async function exportAllDataJson(): Promise<string> {
    const { blocks, brokenKeys } =
      await chromeService.storage.getAllBlockWithBrokenKeys();
    // 壊れたブロックを黙って落としたバックアップは「一見成功した部分バックアップ」になり、
    // export→全データ削除→import で復旧不能なデータ喪失を招く。
    // かといってエクスポート自体を失敗させると、壊れたブロックを個別削除できない現状
    // （#227）では「バックアップ0のまま全データ削除する」以外に手段がなくなるため、
    // 欠けているkeyをJSONに明記したうえで警告を通知して成功させる
    if (brokenKeys.length > 0) {
      await notifyExportBrokenBlocks(brokenKeys);
    }
    return JSON.stringify({
      v: CURRENT_SCHEMA_VERSION,
      ev: chromeService.runtime.getExtensionVersion(),
      // 正常時の出力を変えないよう、欠損がある場合のみフィールドを足す
      ...(brokenKeys.length > 0 ? { broken_keys: brokenKeys } : {}),
      blocks: blocks.map(blockToJsonObj),
    });
  }

  function blockListForJsonObject(
    json: unknown[],
    startIndex: number,
  ): model.Block[] {
    return json.map((obj, i) => jsonObjToBlock(obj, startIndex + i));
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
    const idx = tabLength;

    const json: unknown = JSON.parse(jsonStr);
    let blockObjs: unknown[];
    if (Array.isArray(json)) {
      // v1のエクスポートはブロックの素の配列
      blockObjs = json;
    } else {
      const envelope = (
        json != null && typeof json === 'object' ? json : {}
      ) as { v?: unknown; blocks?: unknown };
      switch (envelope.v) {
        case 2:
          if (!Array.isArray(envelope.blocks)) {
            throw new Error('Invalid export data: blocks is not an array');
          }
          blockObjs = envelope.blocks;
          break;
        default:
          throw new Error(`Unsupported data version: v=${String(envelope.v)}`);
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

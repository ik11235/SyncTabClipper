import { model } from './types/interface';
import { zlibWrapper } from './zlib-wrapper';
import { compression } from './compression';
import { chromeService } from './chromeService';

export namespace blockService {
  // storage.syncに保存するデータのスキーマ版数
  // バージョン情報を持たない従来形式を暗黙のv1とみなし、v2からフィールドを付与する
  // v3から圧縮方式をzlib.jsからネイティブCompressionStream(deflate-raw)に変更
  // 移行は遅延移行: 読み取りはv1/v2/v3すべてに対応し、保存は常にv3で行う
  export const CURRENT_SCHEMA_VERSION = 3;

  // エクスポートJSONのスキーマ版数。エクスポートは非圧縮のため圧縮方式の変更に
  // 影響されず、v2から形式が変わっていない。保存側に追随して上げると旧バージョンの
  // 拡張機能でインポートできなくなるだけなので、形式が変わるまでv2に据え置く
  export const CURRENT_EXPORT_VERSION = 2;

  // インポートで受け付けるエクスポートJSONの版数。過去に出力したJSONを読めなく
  // しないため、CURRENT_EXPORT_VERSIONを上げるときは古い版数を残したまま追加する
  // （v1のエクスポートはブロックの素の配列で版数を持たないため、ここには含めない）
  export const SUPPORTED_EXPORT_VERSIONS: readonly number[] = [2];

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
   * この拡張機能が知らないスキーマ版数のデータを読もうとしたときの例外。
   * 壊れたデータと違い、新しいバージョンで保存された正常なデータでありうる
   * （sync経由で新しい端末から降りてくる）ため、呼び出し側で区別できるようにする
   */
  export class UnsupportedVersionError extends Error {}

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
      // 名前のないブロックにキーを増やさない。storage.syncの8KB/item制限を
      // titleで圧迫しないためと、名前を持たない従来のデータと同じ形を保つため
      ...(block.title == null ? {} : { title: block.title }),
      // ロックしていないブロックも同様にキーを作らない。
      // falseを書いてもロックしていないことしか意味せず、既定値と同じ
      ...(block.locked === true ? { locked: true } : {}),
      // スターも同じ。付けていないブロックにキーを作らない
      ...(block.starred === true ? { starred: true } : {}),
    };
  }

  /**
   * 一覧に並べるときのブロックの比較関数。
   * 第一キーがスター（お気に入り）の有無、第二キーが作成日の降順。
   * storageから読み込んだ直後の並びと、スターを付け外しした後の並びを
   * 同じ規則にするため、storage側とUI側の両方からこれを使う
   * @param {model.BlockEntry} a 比較する要素
   * @param {model.BlockEntry} b 比較する要素
   * @return {number} Array.prototype.sortの比較結果
   */
  export function compareBlockEntry(
    a: model.BlockEntry,
    b: model.BlockEntry,
  ): number {
    const aBroken = isBrokenBlock(a);
    const bBroken = isBrokenBlock(b);
    if (aBroken || bBroken) {
      // BrokenBlockはcreatedAtもスターも分からないため末尾に寄せる
      return Number(aBroken) - Number(bBroken);
    }
    if ((a.starred === true) !== (b.starred === true)) {
      // スターを付けたブロックを先頭へ。作成日より優先する
      return a.starred === true ? -1 : 1;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  }

  // エクスポート/ストレージJSONのブロック表現（v2エンベロープのフィールドを含む）
  // titleはv3の途中で追加した省略可能なフィールドで、スキーマ版数は上げていない。
  // 版数を上げると旧バージョンの拡張機能がsync経由で降りてきたブロックを
  // UnsupportedVersionErrorで一切表示できなくなるため。
  // 代わりに、titleを知らない旧バージョンが同じブロックを書き戻すと
  // （タブを削除する等）名前は失われる。表示できなくなるよりは軽い副作用として許容する。
  // なお一覧はstorage.onChangedを購読して他のページ・他端末の変更に追随する
  // （#249）が、書き込みの直前に届いた変更は取り込めないため、同じバージョン
  // 同士でも打ち消し合う窓は残っている。これはタブの増減でも同じで、
  // titleに固有のものではない
  // lockedもtitleと同じく、スキーマ版数を上げずに追加した省略可能なフィールド。
  // lockedを知らない旧バージョンが同じブロックを書き戻すとロックは失われるが、
  // 版数を上げて旧バージョンから一切表示できなくするより軽い副作用とみなす。
  // ロックはこの拡張機能のUIの誤操作を防ぐもので、データの改変を保証する仕組みではない
  // starredもtitle/lockedと同じ扱い。スターを知らない旧バージョンが書き戻すと
  // 失われるが、失われるのは一覧での並び順と装飾だけで、タブは残る
  type BlockJson = {
    created_at: number;
    tabs: model.Tab[];
    title?: string;
    locked?: boolean;
    starred?: boolean;
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

  /**
   * 保存データのtitleをブロックの名前に変換する。
   * 型では文字列だが、インポートしたJSONには型の検証がないため実際には
   * 何でも入りうる。文字列以外をそのままblock.titleに持たせると
   * レンダリングで例外になりブロックごと破損カードに落ちるため、
   * createdAtをtoCreatedAtで正規化しているのと同じようにここで吸収する。
   * 引数をunknownで受けるのは、BlockJsonの型を信じると
   * この判定が「不可能な条件」として消されてしまうため
   * @param {unknown} title 保存データが持っていたtitle
   * @return {string | undefined} ブロックの名前。名前として扱えない値ならundefined
   */
  function toBlockTitle(title: unknown): string | undefined {
    if (typeof title === 'string') {
      // 空文字列と空白だけの文字列は名前なしと同じ扱いにして、デフォルトの
      // タブ数表示に戻す。空白だけの名前を通すと見出しが空のカードになり、
      // 編集アイコンを見つける以外に直す手がかりがなくなる
      // （UI側もtrimしてから保存するので、読み込み側の正規化もそれに揃える）
      const trimmed = title.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    // 数値になった名前は元の名前を復元できる情報なので、捨てずに文字列として
    // 見せる。真偽値やオブジェクトからは名前を復元できず、本物の名前と
    // 区別できないまま永続化されて往復するだけなので名前なしとして扱う
    if (typeof title === 'number') {
      return String(title);
    }
    return undefined;
  }

  /**
   * ブロックへ名前を載せる。名前がないときはtitleのキー自体を作らず、
   * 名前を持たないブロックの形を従来どおりに保つ
   * @param {unknown} title 保存データが持っていたtitle
   * @return {object} titleを持つオブジェクト。名前がなければ空オブジェクト
   */
  function blockTitleField(title: unknown): { title?: string } {
    const blockTitle = toBlockTitle(title);
    return blockTitle == null ? {} : { title: blockTitle };
  }

  /**
   * ブロックへロック状態を載せる。ロックしていないときはlockedのキー自体を
   * 作らず、ロックを知らなかった頃のブロックと同じ形を保つ。
   * titleと同じくインポートしたJSONには型の検証がないため、
   * 真偽値のtrue以外はロックとみなさない（"false"のような文字列を
   * truthyとして拾うと、解除できないブロックができてしまう）
   * @param {unknown} locked 保存データが持っていたlocked
   * @return {object} lockedを持つオブジェクト。ロックしていなければ空オブジェクト
   */
  function blockLockedField(locked: unknown): { locked?: boolean } {
    return locked === true ? { locked: true } : {};
  }

  /**
   * ブロックへスターを載せる。lockedと同じく、付けていないときはキー自体を
   * 作らず、真偽値のtrue以外はスターとみなさない
   * @param {unknown} starred 保存データが持っていたstarred
   * @return {object} starredを持つオブジェクト。付いていなければ空オブジェクト
   */
  function blockStarredField(starred: unknown): { starred?: boolean } {
    return starred === true ? { starred: true } : {};
  }

  function jsonObjToBlock(object: BlockJson, index: number): model.Block {
    return {
      indexNum: index,
      createdAt: toCreatedAt(object.created_at),
      tabs: object.tabs,
      ...blockTitleField(object.title),
      ...blockLockedField(object.locked),
      ...blockStarredField(object.starred),
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
      ...blockTitleField(js.title),
      ...blockLockedField(js.locked),
      ...blockStarredField(js.starred),
    };
  }

  export async function inflateJson(
    jsonStr: string,
    indexNum: number,
  ): Promise<model.Block> {
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
      case 3:
        // v3はdフィールドがdeflate-raw+UTF-8+base64の圧縮ペイロード
        return js.d == null
          ? jsonObjToBlock(js, indexNum)
          : jsonToBlock(await compression.decompress(js.d), indexNum);
      default:
        throw new UnsupportedVersionError(
          `Unsupported data version: v=${version}`,
        );
    }
  }

  export async function deflateBlock(block: model.Block): Promise<string> {
    // 圧縮アルゴリズムの変更に備え、バージョン情報は圧縮ペイロードの外側に置く
    const version = {
      v: CURRENT_SCHEMA_VERSION,
      ev: chromeService.runtime.getExtensionVersion(),
    };
    const blockStr = JSON.stringify({ ...version, ...blockToJsonObj(block) });
    const deflateStr = JSON.stringify({
      ...version,
      d: await compression.compress(blockToJson(block)),
    });
    // storage.syncの8KB/item制限はUTF-8バイト数で数えるため、文字数ではなく
    // バイト数で比較する。日本語主体のブロックでは1文字が3バイトになり、
    // 文字数では短く見える非圧縮側が制限を超えることがある
    if (utf8ByteLength(deflateStr) < utf8ByteLength(blockStr)) {
      return deflateStr;
    } else {
      return blockStr;
    }
  }

  function utf8ByteLength(val: string): number {
    return new TextEncoder().encode(val).length;
  }

  /**
   * エクスポート結果。欠けたバックアップを完全なものと誤解させないよう、
   * 出力できなかったブロックの件数を呼び出し側へ返す
   */
  export type ExportResult = {
    json: string;
    // 出力できなかったブロックの件数。復元に失敗したブロックのみを数える。
    // 描画に失敗するブロックは復元自体は成功していて出力にも含まれるため、
    // 一覧に出る破損カードの枚数とは一致しない
    brokenCount: number;
  };

  export function exportAllDataJson(): Promise<ExportResult> {
    return chromeService.storage.getAllBlock().then((entries) => {
      // 復元できなかったブロックはブロックJSONに戻せないため出力できない
      const blocks = entries.flatMap((entry) =>
        isBrokenBlock(entry) ? [] : [blockToJsonObj(entry)],
      );
      return {
        json: JSON.stringify({
          v: CURRENT_EXPORT_VERSION,
          ev: chromeService.runtime.getExtensionVersion(),
          blocks: blocks,
        }),
        brokenCount: entries.length - blocks.length,
      };
    });
  }

  function blockListForJsonObject(
    json: BlockJson[],
    startIndex: number,
  ): model.Block[] {
    return json.map((obj, i) => jsonObjToBlock(obj, startIndex + i));
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const nextIndex = await chromeService.storage.getNextBlockIndex();

    const json = JSON.parse(jsonStr);
    let blockObjs: BlockJson[];
    if (Array.isArray(json)) {
      // v1のエクスポートはブロックの素の配列
      blockObjs = json;
    } else {
      if (!SUPPORTED_EXPORT_VERSIONS.includes(json.v)) {
        throw new Error(`Unsupported data version: v=${json.v}`);
      }
      blockObjs = json.blocks;
    }
    // 1件でも書き込めないブロックが混ざっていると一部だけ書き込まれた状態になる。
    // 書き込めた分は一覧に出るようになった（採番も保存済みindexの最大値+1なので
    // 次回保存で上書きされない）が、途中で例外になると残りが書き込まれないため、
    // スキーマ由来のものは書き込む前にまとめて弾く。
    // 書き込み自体の失敗（8KB制限超過など）による部分書き込みは別課題
    if (!Array.isArray(blockObjs)) {
      throw new Error('Invalid data: blocks is not an array');
    }
    if (blockObjs.some((obj) => !Array.isArray(obj?.tabs))) {
      throw new Error('Invalid data: block has no tabs array');
    }
    const blocks = blockListForJsonObject(blockObjs, nextIndex);

    await Promise.all(
      blocks.map((block) => chromeService.storage.setBlock(block)),
    );
    await chromeService.storage.setTabLength(nextIndex + blockObjs.length);
    chrome.tabs.reload({ bypassCache: true });
  }
}

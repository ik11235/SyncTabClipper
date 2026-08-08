export namespace util {
  /**
   * 渡されたURL文字列からドメイン部分を抽出する
   * URLでない文字列を渡した場合、空文字列を返す
   *
   * @param {string} str ドメイン部分を抽出したいURL
   * @return {string} strのドメイン部分 or 空文字列
   */
  export function getDomain(str: string): string {
    try {
      const parser = new URL(str);
      return parser.hostname;
    } catch {
      // ブラウザのURLコンストラクタはcodeを持たないTypeErrorを投げるため、
      // エラーの種類で分岐すると再スローになり、空文字列のurlを持つタブ1件で
      // ErrorBoundaryが一覧全体を落とす。URL.canParseはChrome 120以降で、
      // manifestのminimum_chrome_version(110)では使えないためtry/catchで握り潰す
      return '';
    }
  }

  /**
   * 渡された文字列をNumberに変換する
   * 変換できない場合、例外を出力
   *
   * @param {string | number} str 数字に変換したい文字列
   * @return {number} strを変換した数字
   */
  export function toNumber(str: string | number): number {
    const num = Number(str);
    if (isNaN(num)) {
      throw new Error('to Number Error: ' + str);
    }
    return num;
  }
}

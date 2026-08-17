export namespace util {
  /**
   * 渡されたURL文字列からドメイン部分を抽出する
   * URLでない文字列を渡した場合、空文字列を返す
   *
   * @param {string} str ドメイン部分を抽出したいURL
   * @return {string} strのドメイン部分 or 空文字列
   */
  export function getDomain(str: string): string {
    if (!isValidUrl(str)) {
      return '';
    }
    return new URL(str).hostname;
  }

  /**
   * 渡された文字列がURLとして解釈できるかを判定する
   *
   * @param {string} str 判定したい文字列
   * @return {boolean} URLとして解釈できるならtrue
   */
  export function isValidUrl(str: string): boolean {
    return URL.canParse(str);
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

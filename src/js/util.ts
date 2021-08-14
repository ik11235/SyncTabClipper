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
    } catch (e) {
      if (e.code === 'ERR_INVALID_URL') {
        return '';
      } else {
        throw e;
      }
    }
  }

  /**
   * HTMLの特殊文字をエスケープして返す
   * https://qiita.com/saekis/items/c2b41cd8940923863791
   *
   * @param {string} string htmlとしてエスケープしたい文字列
   * @return {string} エスケープした文字列
   */
  export function escapeHtml(string: string): string {
    // @ts-ignore
    return string.replace(/[&'`"<>]/g, function (match) {
      return {
        '&': '&amp;',
        "'": '&#x27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      }[match];
    });
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

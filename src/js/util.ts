export namespace util {
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

  export function toNumber(str: string | number): number {
    const num = Number(str);
    if (isNaN(num)) {
      throw new Error('to Number Error: ' + str);
    }
    return num;
  }
}

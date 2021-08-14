export namespace zlibWrapper {
  const Buffer = require('buffer').Buffer;

  const btoaLatin1 = function (str: string): string {
    return Buffer.from(str, 'latin1').toString('base64');
  };
  const atobLatin1 = function (b64Encoded: string): string {
    return Buffer.from(b64Encoded, 'base64').toString('latin1');
  };

  /**
   * zlibを利用して引数の文字列を圧縮する
   * @param {string} val 圧縮したい文字列
   * @return {string} 圧縮した文字列
   */
  export function deflate(val: string): string {
    const encodeVal = encodeURIComponent(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const zStream = ZLIB.deflateInit({ level: 9 });
    const encodedString = zStream.deflate(encodeVal);
    return btoaLatin1(encodedString);
  }

  /**
   * zlibを利用して引数の圧縮された文字列を解凍する
   * @param {string} val 圧縮された文字列
   * @return {string} valを解凍した文字列
   */
  export function inflate(val: string): string {
    const tobVal = atobLatin1(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const zStream = ZLIB.inflateInit();
    const decodedString = zStream.inflate(tobVal);
    return decodeURIComponent(decodedString);
  }
}

// zlib*.jsは非モジュールのレガシーJSで、globalThis.ZLIBを介して相互参照する
// side-effect importでbackground/tabs両バンドルに同梱し、ロード経路を一本化する
// v3(compression.ts)への移行後も、v1/v2の既存圧縮データを読むためにinflate側のみ残す
// (zlib.jsのdeflate出力は標準zlibと非互換のため、標準実装では解凍できない)
import './zlib.js';
import './zlib-inflate.js';

export namespace zlibWrapper {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- webpackのbuffer polyfill解決に依存
  const Buffer = require('buffer').Buffer;

  const atobLatin1 = function (b64Encoded: string): string {
    return Buffer.from(b64Encoded, 'base64').toString('latin1');
  };

  /**
   * zlibを利用して引数の圧縮された文字列を解凍する
   * @param {string} val 圧縮された文字列
   * @return {string} valを解凍した文字列
   */
  export function inflate(val: string): string {
    const tobVal = atobLatin1(val);
    // @ts-expect-error ZLIBはzlib.jsがglobalThisに定義する型定義のないグローバル
    const zStream = ZLIB.inflateInit();
    const decodedString = zStream.inflate(tobVal);
    return decodeURIComponent(decodedString);
  }
}

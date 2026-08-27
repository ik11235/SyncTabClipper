// zlib*.jsは非モジュールのレガシーJSで、globalThis.ZLIBを介して相互参照する
// side-effect importでbackground/tabs両バンドルに同梱し、ロード経路を一本化する
// v3(compression.ts)への移行後も、v1/v2の既存圧縮データを読むためにinflate側のみ残す
// (zlib.jsのdeflate出力は標準zlibと非互換のため、標準実装では解凍できない)
import './zlib.js';
import './zlib-inflate.js';

export namespace zlibWrapper {
  /**
   * base64をlatin1の文字列へ戻す。
   * zlib.jsのinflateはバイト列を1文字1バイトの文字列で受け取るため、
   * UTF-8として解釈させずコードポイントをそのままバイトとして渡す。
   * bufferのポリフィル(Buffer.from(...).toString('latin1'))でも同じことが
   * できるが、それだけのためにbuffer/base64-js/ieee754の3つが
   * 両バンドルへ入る（minify前で約64KB）ので、atobで済ませる
   * @param {string} b64Encoded base64の文字列
   * @return {string} 1文字1バイトの文字列
   */
  const atobLatin1 = function (b64Encoded: string): string {
    return atob(b64Encoded);
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

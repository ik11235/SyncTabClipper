export namespace zlibWrapper {
  const Buffer = require('buffer').Buffer;

  const btoaLatin1 = function (str: string): string {
    return Buffer.from(str, 'latin1').toString('base64');
  };
  const atobLatin1 = function (b64Encoded: string): string {
    return Buffer.from(b64Encoded, 'base64').toString('latin1');
  };

  export function deflate(val: string): string {
    const encodeVal = encodeURIComponent(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const zStream = ZLIB.deflateInit({ level: 9 });
    const encodedString = zStream.deflate(encodeVal);
    return btoaLatin1(encodedString);
  }

  export function inflate(val: string): string {
    const tobVal = atobLatin1(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const zStream = ZLIB.inflateInit();
    const decodedString = zStream.inflate(tobVal);
    return decodeURIComponent(decodedString);
  }
}

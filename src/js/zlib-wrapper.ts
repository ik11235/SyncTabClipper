export namespace zlibWrapper {
  let Buffer = require('buffer').Buffer

  const btoaLatin1 = function (str: string): string {
    return Buffer.from(str, 'latin1').toString('base64');
  }
  const atobLatin1 = function (b64Encoded: string): string {
    return Buffer.from(b64Encoded, 'base64').toString('latin1');
  }

  export function deflate(val: string): string {
    const encodeVal = encodeURIComponent(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const z_stream = ZLIB.deflateInit({level: 9});
    const encoded_string = z_stream.deflate(encodeVal);
    return btoaLatin1(encoded_string)
  }

  export function inflate(val: string): string {
    const tobVal = atobLatin1(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const z_stream = ZLIB.inflateInit();
    const decoded_string = z_stream.inflate(tobVal);
    return decodeURIComponent(decoded_string);
  }
}

// スキーマv3の圧縮実装。
// ブラウザネイティブのCompressionStream/DecompressionStream('deflate-raw')を使い、
// TextEncoder(UTF-8)でエンコードしてからbase64化する。外部ライブラリ依存なし。
// 旧方式(zlib.js)と異なりencodeURIComponentを介さないため、日本語等の
// マルチバイト文字列で保存サイズが小さくなる。
export namespace compression {
  async function readAll(
    stream: ReadableStream<Uint8Array>,
  ): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  function bytesToBase64(bytes: Uint8Array): string {
    let bin = '';
    // 大きな配列でString.fromCharCode(...bytes)は引数上限に達するため1バイトずつ結合する
    for (const byte of bytes) {
      bin += String.fromCharCode(byte);
    }
    return btoa(bin);
  }

  function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 文字列をUTF-8エンコードし、deflate-rawで圧縮してbase64文字列にする
   * @param {string} val 圧縮したい文字列
   * @return {Promise<string>} 圧縮後のbase64文字列
   */
  export async function compress(val: string): Promise<string> {
    const bytes = new TextEncoder().encode(val);
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    // 書き込み完了は読み出しの進行に依存するため、awaitせず読み出しと並行させる
    const writeDone = writer.write(bytes).then(() => writer.close());
    const compressed = await readAll(stream.readable);
    await writeDone;
    return bytesToBase64(compressed);
  }

  /**
   * compressで圧縮したbase64文字列を元の文字列に復元する
   * @param {string} val 圧縮されたbase64文字列
   * @return {Promise<string>} 復元した文字列
   */
  export async function decompress(val: string): Promise<string> {
    const bytes = base64ToBytes(val);
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const writeDone = writer.write(bytes).then(() => writer.close());
    const decompressed = await readAll(stream.readable);
    await writeDone;
    return new TextDecoder().decode(decompressed);
  }
}

// jsdom環境にはTextEncoder/TextDecoderやWeb Streams API
// (CompressionStream等)が存在しないため、Nodeの実装を注入する。
// テスト専用のポリフィルであり、プロダクションコード(Chrome拡張の実行環境)
// にはネイティブ実装が存在するため不要。
const { TextEncoder, TextDecoder } = require('node:util');
const webStreams = require('node:stream/web');

const polyfills = {
  TextEncoder,
  TextDecoder,
  ReadableStream: webStreams.ReadableStream,
  WritableStream: webStreams.WritableStream,
  TransformStream: webStreams.TransformStream,
  CompressionStream: webStreams.CompressionStream,
  DecompressionStream: webStreams.DecompressionStream,
};

for (const [name, impl] of Object.entries(polyfills)) {
  if (typeof globalThis[name] === 'undefined') {
    globalThis[name] = impl;
  }
}

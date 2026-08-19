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

// jsdomはレイアウトを持たないためscrollIntoViewを実装していない。
// 呼び出すとTypeErrorになりテストが本番と違う経路を通るため、
// 何もしない実装を入れる（本番のChromeにはネイティブ実装がある）。
// 呼ばれたことの検証はテスト側でspyOnして行う
if (
  typeof globalThis.Element !== 'undefined' &&
  typeof globalThis.Element.prototype.scrollIntoView !== 'function'
) {
  globalThis.Element.prototype.scrollIntoView = function () {};
}

// jsdomはWeb Animations APIを実装していない。
// 呼び出すとTypeErrorになりテストが本番と違う経路を通るため、
// 何もしない実装を入れる（本番のChromeにはネイティブ実装がある）。
// どんなアニメーションを指示したかの検証はテスト側でspyOnして行う
if (
  typeof globalThis.Element !== 'undefined' &&
  typeof globalThis.Element.prototype.animate !== 'function'
) {
  globalThis.Element.prototype.animate = function () {
    return {
      cancel: function () {},
      finish: function () {},
      finished: Promise.resolve(),
      play: function () {},
      pause: function () {},
    };
  };
}

// jsdomはメディアクエリを評価しないためmatchMediaも持たない。
// どのクエリにも一致しない実装を入れる（本番のChromeにはネイティブ実装がある）。
// 一致する状態を試すテストはspyOnで差し替える
if (
  typeof globalThis.window !== 'undefined' &&
  typeof globalThis.window.matchMedia !== 'function'
) {
  globalThis.window.matchMedia = function (query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {
        return false;
      },
    };
  };
}

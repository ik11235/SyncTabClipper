import { zlibWrapper } from './zlib-wrapper';

// Manifest V2時点(master)のzlib実装で生成した圧縮データ。
// zlibのバンドル方法を変えてもstorage.sync上の既存データを
// 読み書きできることを保証するゴールデンフィクスチャ。
const masterDeflatedBase64 =
  'eNqMj10OgjAQhE+zjxostJTH8tNrmIoNaDAg1MTjOy1IYpTEZLOZ2e432VKaE2P1aI2z56NxMBSrg4gyzoVIuEglsQJTZ07T/Eg8p0A9xm6ZMNY6N0xBapR9mtvQ2X3d3+CcnULunHNxnV2x4HbvhbT0Oz+z1+im75uPZLYRPS/+k/1993WAGYxrKdZ3ioHySqBlKZriqy289a2SXik/qzbuISDgQXtREDhQYEBUMUlGuV6ESoJAyUWonHREmaZMkYyW//AS/QUAAP//';

const originalJson =
  '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"},{"url":"https://example.jp/path?q=%E6%97%A5%E6%9C%AC%E8%AA%9E","title":"日本語タイトル🚀"}]}';

describe('zlibWrapper', () => {
  test('master時点の圧縮データを復元できる（既存データ互換）', (): void => {
    expect(zlibWrapper.inflate(masterDeflatedBase64)).toBe(originalJson);
  });

  test('deflateの出力がmaster時点と一致する', (): void => {
    expect(zlibWrapper.deflate(originalJson)).toBe(masterDeflatedBase64);
  });

  test('deflate→inflateの往復で元に戻る', (): void => {
    expect(zlibWrapper.inflate(zlibWrapper.deflate(originalJson))).toBe(
      originalJson
    );
  });
});

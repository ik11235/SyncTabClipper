/**
 * @jest-environment jsdom
 *
 * inflateはブラウザで動くコードで、base64の復号にWHATWGのatobを使う。
 * nodeのatobは別実装で投げる例外も違うため、jsdomで検証する
 */
import { zlibWrapper } from './zlib-wrapper';

// Manifest V2時点(master)のzlib実装で生成した圧縮データ。
// zlib.jsのdeflateはv3移行で削除済みだが、storage.sync上の
// 既存データ(v1/v2)を読めることを保証するゴールデンフィクスチャ。
const masterDeflatedBase64 =
  'eNqMj10OgjAQhE+zjxostJTH8tNrmIoNaDAg1MTjOy1IYpTEZLOZ2e432VKaE2P1aI2z56NxMBSrg4gyzoVIuEglsQJTZ07T/Eg8p0A9xm6ZMNY6N0xBapR9mtvQ2X3d3+CcnULunHNxnV2x4HbvhbT0Oz+z1+im75uPZLYRPS/+k/1993WAGYxrKdZ3ioHySqBlKZriqy289a2SXik/qzbuISDgQXtREDhQYEBUMUlGuV6ESoJAyUWonHREmaZMkYyW//AS/QUAAP//';

const originalJson =
  '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"},{"url":"https://example.jp/path?q=%E6%97%A5%E6%9C%AC%E8%AA%9E","title":"日本語タイトル🚀"}]}';

describe('zlibWrapper', () => {
  test('master時点の圧縮データを復元できる（既存データ互換）', (): void => {
    expect(zlibWrapper.inflate(masterDeflatedBase64)).toBe(originalJson);
  });
});

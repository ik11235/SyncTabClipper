/**
 * @jest-environment jsdom
 */
import { compression } from './compression';

// v3(deflate-raw + UTF-8 + base64)形式で生成した圧縮データ。
// 圧縮実装を変更してもstorage.sync上の既存v3データを
// 読み書きできることを保証するゴールデンフィクスチャ。
const v3CompressedBase64 =
  'q1ZKLkpNLElNiU8sUbIyNDOwNDU1MzMxNTO30FEqSUwqVrKKrlYqLcpRslLKKCkpKLbS10+tSMwtyEnVS87P1S9JLS5R0lEqySzJSVWygtC6YMFaHWR9Vvr66fn56Ui6jJC0QaSw6UO2L6tAvyCxJMO+0FbV1UzV0lzV0RTMcFZ1dFZ1tVB1dFS1dEUy9dn0pc/mrHmxat7jpv2Pm5Y8bu543Lz6w/xZDUq1sbUA';

const originalJson =
  '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"},{"url":"https://example.jp/path?q=%E6%97%A5%E6%9C%AC%E8%AA%9E","title":"日本語タイトル🚀"}]}';

describe('compression', () => {
  test('v3ゴールデンフィクスチャを復元できる（既存データ互換）', async (): Promise<void> => {
    await expect(compression.decompress(v3CompressedBase64)).resolves.toBe(
      originalJson,
    );
  });

  test('compressの出力がゴールデンフィクスチャと一致する', async (): Promise<void> => {
    await expect(compression.compress(originalJson)).resolves.toBe(
      v3CompressedBase64,
    );
  });

  test('compress→decompressの往復で元に戻る', async (): Promise<void> => {
    const input =
      '{"title":"日本語タイトル🚀🎉","url":"https://例え.jp/テスト?q=絵文字😀"}';
    await expect(
      compression.compress(input).then(compression.decompress),
    ).resolves.toBe(input);
  });

  test('空文字列も往復できる', async (): Promise<void> => {
    await expect(
      compression.compress('').then(compression.decompress),
    ).resolves.toBe('');
  });

  // 書き込み側のPromiseを握り忘れると、これらは未処理rejectionになり
  // 呼び出し側のcatchをすり抜けてコンソールを汚す
  test('不正なdeflateデータはrejectする（未処理rejectionを残さない）', async (): Promise<void> => {
    await expect(
      compression.decompress(btoa('not a deflate')),
    ).rejects.toThrow();
  });

  test('途中で切れたデータはrejectする（未処理rejectionを残さない）', async (): Promise<void> => {
    const truncated = v3CompressedBase64.slice(0, 20);
    await expect(compression.decompress(truncated)).rejects.toThrow();
  });
});

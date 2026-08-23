/**
 * @jest-environment node
 *
 * service worker(background)から見たblockServiceの検証(#237)。
 *
 * 他のテストがjsdomなのは、node環境との差異で実挙動と乖離しないため
 * （#192がnode環境のテストで2年隠れた経緯がある）。ここだけnodeなのは、
 * 検証したいのが「documentのない環境での振る舞い」そのものだから。
 * jsdomのdocumentは再定義できず、モックでは同じ状況を作れない
 */
import { blockService } from './blockService';

describe('blockService service worker環境', (): void => {
  // v1の圧縮データの体裁（JSONとして解釈できない文字列）。
  // ここでは解凍まで到達しないので、中身が正しいzlibである必要はない
  const legacyCompressed = 'eJyrVkrLz1eyUvJNzE7NUzBUqgUAKp0FUg==';

  beforeEach((): void => {
    // service workerでもchrome.runtimeは使える。
    // deflateBlockがエンベロープに拡張のバージョンを入れる
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: { getManifest: () => ({ version: '9.9.9' }) },
    };
  });

  test('documentがない前提の環境で動かしている', (): void => {
    expect(typeof document).toBe('undefined');
  });

  // zlibは動的importで切り離してあり、webpackが吐くチャンク読み込みは
  // documentを使う。backgroundから呼ぶと黙って壊れるので、
  // 理由の分かる形で止まることを固定する
  test.each([
    ['v1圧縮', legacyCompressed],
    ['v2圧縮', JSON.stringify({ v: 2, ev: '0.3.0', d: legacyCompressed })],
  ])(
    '%sの解凍は理由を添えて止まる',
    async (_name: string, input: string): Promise<void> => {
      await expect(blockService.inflateJson(input, 1)).rejects.toThrow(
        /chunk loader needs a document/,
      );
    },
  );

  // backgroundが実際に通る経路。ここが塞がっていたら保存ができなくなる
  test('非圧縮データはdocumentがなくても読める', async (): Promise<void> => {
    await expect(
      blockService.inflateJson(
        '{"v":2,"created_at":1609556645678,"tabs":[{"url":"https://example.com/a","title":"a"}]}',
        1,
      ),
    ).resolves.toStrictEqual({
      indexNum: 1,
      createdAt: new Date(1609556645678),
      tabs: [{ url: 'https://example.com/a', title: 'a' }],
    });
  });

  // 書き込み経路(deflateBlock)はv3のCompressionStreamだけを使う。
  // zlibに触れないことが、backgroundからzlibを外せる前提になっている
  test('ブロックの書き込みはzlibに触れずに済む', async (): Promise<void> => {
    const stored = await blockService.deflateBlock({
      indexNum: 0,
      createdAt: new Date(1609556645678),
      tabs: [{ url: 'https://example.com/a', title: 'a' }],
    });

    expect(JSON.parse(stored).v).toBe(blockService.CURRENT_SCHEMA_VERSION);
  });
});

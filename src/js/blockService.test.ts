/**
 * @jest-environment jsdom
 */
import { blockService } from './blockService';
import { chromeService } from './chromeService';
import { compression } from './compression';
import { model } from './types/interface';
import { zlibWrapper } from './zlib-wrapper';

// spyOnで差し替える前の実装をゴールデンフィクスチャのテスト用に確保する
const actualZlibInflate = zlibWrapper.inflate;
const actualCompress = compression.compress;
const actualDecompress = compression.decompress;

let compressSpy: jest.SpyInstance;
let decompressSpy: jest.SpyInstance;
let inflateSpy: jest.SpyInstance;
let versionSpy: jest.SpyInstance;

beforeAll(() => {
  compressSpy = jest.spyOn(compression, 'compress');
  decompressSpy = jest.spyOn(compression, 'decompress');
  inflateSpy = jest.spyOn(zlibWrapper, 'inflate');
  versionSpy = jest.spyOn(chromeService.runtime, 'getExtensionVersion');
});

beforeEach(() => {
  versionSpy.mockReturnValue('9.9.9');
});

afterEach(() => {
  compressSpy.mockReset();
  decompressSpy.mockReset();
  inflateSpy.mockReset();
  versionSpy.mockReset();
});

describe('blockService', (): void => {
  test('createBlock 正常系', (): void => {
    const tabs: chrome.tabs.Tab[] = [
      {
        index: 0,
        title: 'title-00',
        url: 'https://exapmle.com/test01',
        pinned: false,
        highlighted: false,
        windowId: 0,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
        frozen: false,
        lastAccessed: 0,
        groupId: 0,
      },
      {
        index: 1,
        title: 'title-02',
        url: 'https://exapmle.com/test002',
        pinned: false,
        highlighted: false,
        windowId: 0,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
        frozen: false,
        lastAccessed: 0,
        groupId: 0,
      },
    ];
    const createdAt = new Date(`2021-01-02T03:04:05.678Z`);
    const res = blockService.createBlock(tabs, createdAt, 1);
    expect(res).toEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          title: 'title-00',
          url: 'https://exapmle.com/test01',
        },
        {
          title: 'title-02',
          url: 'https://exapmle.com/test002',
        },
      ],
    });
  });

  test('blockToJson 正常系', (): void => {
    const block = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
        {
          url: 'http://google.com/test2',
          title: 'google-test',
        },
      ],
    };

    const res = blockService.blockToJson(block);
    expect(res).toBe(
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"}]}',
    );
  });

  test('jsonToBlock 正常系', (): void => {
    const json =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"}]}';

    const res = blockService.jsonToBlock(json, 1);
    const expected = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
        {
          url: 'http://google.com/test2',
          title: 'google-test',
        },
      ],
    };

    expect(res).toStrictEqual(expected);
  });

  test('blockToJson ブロック名を含める', (): void => {
    const block = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      title: '調査中のタブ',
    };

    expect(blockService.blockToJson(block)).toBe(
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"title":"調査中のタブ"}',
    );
  });

  test('jsonToBlock ブロック名を読む', (): void => {
    const json =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"title":"調査中のタブ"}';

    expect(blockService.jsonToBlock(json, 1)).toStrictEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      title: '調査中のタブ',
    });
  });

  // インポートしたJSONには型の検証がないため、titleには何でも入りうる。
  // 文字列以外をそのままblock.titleに持たせるとレンダリングで例外になり、
  // ブロックごと破損カードに落ちる
  test.each([
    ['オブジェクト', '{"ja":"名前"}'],
    ['配列', '["名前"]'],
    ['null', 'null'],
    ['空文字列', '""'],
    // 真偽値からは元の名前を復元できず、"true"を本物の名前と区別できないまま
    // 永続化して往復させるだけになる
    ['真偽値', 'true'],
    // 空白だけの名前を通すと見出しが空のカードになり、タブ数のフォールバックにも
    // 戻らないため直す手がかりが編集アイコンしか残らない
    ['空白だけの文字列', '"   "'],
  ])(
    'jsonToBlock 名前として扱えないtitle(%s)は名前なしとして読む',
    (_name: string, titleJson: string): void => {
      const json = `{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"title":${titleJson}}`;

      expect(blockService.jsonToBlock(json, 1)).toStrictEqual({
        indexNum: 1,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      });
    },
  );

  // UI側はtrimしてから保存するため、読み込み側の正規化もそれに揃える
  test('jsonToBlock titleの前後の空白は落として読む', (): void => {
    const json =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"title":"  調査中のタブ  "}';

    expect(blockService.jsonToBlock(json, 1)).toStrictEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      title: '調査中のタブ',
    });
  });

  test('blockToJson ロックしているブロックはlockedを含める', (): void => {
    const block = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      locked: true,
    };

    expect(blockService.blockToJson(block)).toBe(
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"locked":true}',
    );
  });

  // ロックしていないブロックにキーを増やさない。storage.syncの8KB/item制限を
  // 圧迫しないためと、ロックを知らなかった頃のデータと同じ形を保つため
  test.each([
    ['ロックしていない', false],
    ['ロックしたことがない', undefined],
  ])(
    'blockToJson %sブロックはlockedを含めない',
    (_name: string, locked: boolean | undefined): void => {
      const block = {
        indexNum: 1,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
        locked: locked,
      };

      expect(blockService.blockToJson(block)).toBe(
        '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}',
      );
    },
  );

  test('jsonToBlock ロックを読む', (): void => {
    const json =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"locked":true}';

    expect(blockService.jsonToBlock(json, 1)).toStrictEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      locked: true,
    });
  });

  // インポートやv1の非圧縮データはjsonObjToBlock経由で読むため、
  // jsonToBlockとは別の入口になる
  test('inflateJson 非圧縮のデータからもロックを読む', async (): Promise<void> => {
    const json =
      '{"v":3,"ev":"9.9.9","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"locked":true}';

    await expect(blockService.inflateJson(json, 1)).resolves.toStrictEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      locked: true,
    });
  });

  // インポートしたJSONには型の検証がないため、lockedにも何でも入りうる。
  // truthyな値を拾うと"false"の文字列でロックされ、UIからは解除できるものの
  // 保存のたびに同じ値が往復するわけではない点も含めて紛らわしい。
  // 真偽値のtrueだけをロックとみなす
  test.each([
    ['文字列のfalse', '"false"'],
    ['文字列のtrue', '"true"'],
    ['数値の1', '1'],
    ['false', 'false'],
    ['null', 'null'],
  ])(
    'jsonToBlock ロックとして扱えないlocked(%s)はロックなしとして読む',
    (_name: string, lockedJson: string): void => {
      const json = `{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"locked":${lockedJson}}`;

      expect(blockService.jsonToBlock(json, 1)).toStrictEqual({
        indexNum: 1,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      });
    },
  );

  // 数値になった名前は直せる情報なので、捨てずに文字列として見せる
  test('jsonToBlock 数値のtitleは文字列として読む', (): void => {
    const json =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"title":2021}';

    expect(blockService.jsonToBlock(json, 1)).toStrictEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      title: '2021',
    });
  });

  test('deflateBlock 非圧縮時', async (): Promise<void> => {
    compressSpy.mockResolvedValueOnce(
      'eNpSNXdSNTJKLkpNLElNiU8sAXJUjR0NzQwsTU3NzExMzcwtVI2cgaIliUnFEElVUydVsK7SohyoiJFRRklJQTGY6QZEqRWJuQU5qXrJ+blAXklqMdhciDmZJTmpcG1gni5MgbmLqqkLkAQAAAD//w==',
    );

    const block = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    };
    const expected =
      '{"v":3,"ev":"9.9.9","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}';
    await expect(blockService.deflateBlock(block)).resolves.toBe(expected);
    expect(compressSpy.mock.calls[0]).toEqual([
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}',
    ]);
    expect(compressSpy).toHaveBeenCalledTimes(1);
  });

  test('deflateBlock 圧縮時', async (): Promise<void> => {
    compressSpy.mockResolvedValueOnce(
      'q1ZKLkpNLElNiU8sUbIyNDOwNDU1MzMxNTO30FEqSUwqVrKKrlYqLcpRslLKKCkpKLbS10+tSMwtyEnVS87P1S9JLS5R0lEqySzJSVWygtC6YMFaHWR9Vvr66fn5SLqMkLRBpHTBOmv1cxLzUnNK9JJz4pOTgFYUJyZDzDWGmVsLCAAA//8=',
    );

    const block = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
        {
          url: 'http://google.com/test2',
          title: 'google-test',
        },
        {
          url: 'http://google.com/test3',
          title: 'google-test33',
        },
        {
          url: 'http://google.com/test4',
          title: 'google-test44',
        },
      ],
    };
    const expected =
      '{"v":3,"ev":"9.9.9","d":"q1ZKLkpNLElNiU8sUbIyNDOwNDU1MzMxNTO30FEqSUwqVrKKrlYqLcpRslLKKCkpKLbS10+tSMwtyEnVS87P1S9JLS5R0lEqySzJSVWygtC6YMFaHWR9Vvr66fn5SLqMkLRBpHTBOmv1cxLzUnNK9JJz4pOTgFYUJyZDzDWGmVsLCAAA//8="}';
    await expect(blockService.deflateBlock(block)).resolves.toBe(expected);
    expect(compressSpy.mock.calls[0]).toEqual([
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"},{"url":"http://google.com/test3","title":"google-test33"},{"url":"http://google.com/test4","title":"google-test44"}]}',
    ]);
    expect(compressSpy).toHaveBeenCalledTimes(1);
  });

  // storage.syncの8KB/item制限はUTF-8バイト数で数えるため、文字数で比べると
  // 日本語主体のブロックで非圧縮側が選ばれ、バイト数では制限を超えうる
  test('deflateBlock 圧縮/非圧縮の判定は文字数ではなくUTF-8バイト数で行う', async (): Promise<void> => {
    const compressed = 'A'.repeat(160);
    compressSpy.mockResolvedValueOnce(compressed);

    const block = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/t', title: 'あ'.repeat(80) }],
    };
    const res = await blockService.deflateBlock(block);

    const plain = `{"v":3,"ev":"9.9.9","created_at":1609556645678,"tabs":[{"url":"https://example.com/t","title":"${'あ'.repeat(80)}"}]}`;
    // 文字数では非圧縮の方が短いが、UTF-8バイト数では圧縮の方が短い状況
    expect(res.length).toBeGreaterThan(plain.length);
    expect(new TextEncoder().encode(res).length).toBeLessThan(
      new TextEncoder().encode(plain).length,
    );
    expect(res).toBe(`{"v":3,"ev":"9.9.9","d":"${compressed}"}`);
  });

  test('inflateJson v1非圧縮データ(バージョン表記なし)', async (): Promise<void> => {
    const input =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"}]}';
    const indexNum = 1;
    const expected = {
      indexNum: indexNum,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
        {
          url: 'http://google.com/test2',
          title: 'google-test',
        },
      ],
    };
    await expect(
      blockService.inflateJson(input, indexNum),
    ).resolves.toStrictEqual(expected);
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson v1圧縮データ(バージョン表記なし)', async (): Promise<void> => {
    inflateSpy.mockReturnValueOnce(
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"},{"url":"http://google.com/test3","title":"google-test33"},{"url":"http://google.com/test4","title":"google-test44"}]}',
    );

    const input =
      'eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w==';
    const indexNum = 1;

    const expected = {
      indexNum: indexNum,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
        {
          url: 'http://google.com/test2',
          title: 'google-test',
        },
        {
          title: 'google-test33',
          url: 'http://google.com/test3',
        },
        {
          title: 'google-test44',
          url: 'http://google.com/test4',
        },
      ],
    };
    await expect(
      blockService.inflateJson(input, indexNum),
    ).resolves.toStrictEqual(expected);
    expect(inflateSpy.mock.calls[0]).toEqual([
      'eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w==',
    ]);

    expect(inflateSpy).toHaveBeenCalledTimes(1);
  });

  test('inflateJson v2非圧縮データ', async (): Promise<void> => {
    const input =
      '{"v":2,"ev":"0.3.0","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}';
    const expected = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    };
    await expect(blockService.inflateJson(input, 1)).resolves.toStrictEqual(
      expected,
    );
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson v2圧縮データ', async (): Promise<void> => {
    inflateSpy.mockReturnValueOnce(
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}',
    );

    const input = '{"v":2,"ev":"0.3.0","d":"compressed-data"}';
    const expected = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    };
    await expect(blockService.inflateJson(input, 1)).resolves.toStrictEqual(
      expected,
    );
    expect(inflateSpy.mock.calls[0]).toEqual(['compressed-data']);
    expect(inflateSpy).toHaveBeenCalledTimes(1);
    expect(decompressSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson v3非圧縮データ', async (): Promise<void> => {
    const input =
      '{"v":3,"ev":"1.0.0","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}';
    const expected = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    };
    await expect(blockService.inflateJson(input, 1)).resolves.toStrictEqual(
      expected,
    );
    expect(decompressSpy).toHaveBeenCalledTimes(0);
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson v3圧縮データ', async (): Promise<void> => {
    decompressSpy.mockResolvedValueOnce(
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}',
    );

    const input = '{"v":3,"ev":"1.0.0","d":"compressed-data"}';
    const expected = {
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    };
    await expect(blockService.inflateJson(input, 1)).resolves.toStrictEqual(
      expected,
    );
    expect(decompressSpy.mock.calls[0]).toEqual(['compressed-data']);
    expect(decompressSpy).toHaveBeenCalledTimes(1);
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson 未対応バージョンはエラー(圧縮)', async (): Promise<void> => {
    const input = '{"v":99,"ev":"99.0.0","d":"compressed-data"}';
    await expect(blockService.inflateJson(input, 1)).rejects.toThrow(
      'Unsupported data version: v=99',
    );
    expect(inflateSpy).toHaveBeenCalledTimes(0);
    expect(decompressSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson 未対応バージョンはエラー(非圧縮)', async (): Promise<void> => {
    const input =
      '{"v":99,"ev":"99.0.0","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}';
    await expect(blockService.inflateJson(input, 1)).rejects.toThrow(
      'Unsupported data version: v=99',
    );
    expect(inflateSpy).toHaveBeenCalledTimes(0);
    expect(decompressSpy).toHaveBeenCalledTimes(0);
  });
});

describe('blockService 旧形式ゴールデンフィクスチャ(実データ互換)', (): void => {
  // Manifest V2時点(master)のzlib実装で生成した圧縮データ
  const masterDeflatedBase64 =
    'eNqMj10OgjAQhE+zjxostJTH8tNrmIoNaDAg1MTjOy1IYpTEZLOZ2e432VKaE2P1aI2z56NxMBSrg4gyzoVIuEglsQJTZ07T/Eg8p0A9xm6ZMNY6N0xBapR9mtvQ2X3d3+CcnULunHNxnV2x4HbvhbT0Oz+z1+im75uPZLYRPS/+k/1993WAGYxrKdZ3ioHySqBlKZriqy289a2SXik/qzbuISDgQXtREDhQYEBUMUlGuV6ESoJAyUWonHREmaZMkYyW//AS/QUAAP//';

  // v3(deflate-raw + UTF-8 + base64)形式で生成した同一内容の圧縮データ
  const v3CompressedBase64 =
    'q1ZKLkpNLElNiU8sUbIyNDOwNDU1MzMxNTO30FEqSUwqVrKKrlYqLcpRslLKKCkpKLbS10+tSMwtyEnVS87P1S9JLS5R0lEqySzJSVWygtC6YMFaHWR9Vvr66fn56Ui6jJC0QaSw6UO2L6tAvyCxJMO+0FbV1UzV0lzV0RTMcFZ1dFZ1tVB1dFS1dEUy9dn0pc/mrHmxat7jpv2Pm5Y8bu543Lz6w/xZDUq1sbUA';

  const expected = {
    indexNum: 1,
    createdAt: new Date(1609556645678),
    tabs: [
      {
        url: 'https://example.com/test',
        title: 'title-test',
      },
      {
        url: 'http://google.com/test2',
        title: 'google-test',
      },
      {
        url: 'https://example.jp/path?q=%E6%97%A5%E6%9C%AC%E8%AA%9E',
        title: '日本語タイトル🚀',
      },
    ],
  };

  test('v1圧縮データ(素のzlib+base64文字列)を読める', async (): Promise<void> => {
    inflateSpy.mockImplementationOnce(actualZlibInflate);
    await expect(
      blockService.inflateJson(masterDeflatedBase64, 1),
    ).resolves.toStrictEqual(expected);
  });

  test('v2圧縮データ(エンベロープ形式)を読める', async (): Promise<void> => {
    inflateSpy.mockImplementationOnce(actualZlibInflate);
    const input = JSON.stringify({
      v: 2,
      ev: '0.3.0',
      d: masterDeflatedBase64,
    });
    await expect(blockService.inflateJson(input, 1)).resolves.toStrictEqual(
      expected,
    );
  });

  test('v3圧縮データ(エンベロープ形式)を読める', async (): Promise<void> => {
    decompressSpy.mockImplementationOnce(actualDecompress);
    const input = JSON.stringify({
      v: 3,
      ev: '1.0.0',
      d: v3CompressedBase64,
    });
    await expect(blockService.inflateJson(input, 1)).resolves.toStrictEqual(
      expected,
    );
  });

  // 他のdeflateBlockテストはcompressをモックしており、エンベロープ生成と
  // 実圧縮の合成は検証されていない。実装を通した往復で担保する
  test.each([
    ['圧縮が選ばれるブロック', expected],
    [
      '非圧縮が選ばれるブロック',
      {
        indexNum: 1,
        createdAt: new Date(1609556645678),
        tabs: [{ url: 'https://example.com/a', title: 'a' }],
      },
    ],
    [
      'ブロック名を持つブロック',
      {
        indexNum: 1,
        createdAt: new Date(1609556645678),
        tabs: [{ url: 'https://example.com/a', title: 'a' }],
        title: '調査中のタブ',
      },
    ],
  ])(
    'deflateBlock→inflateJson(%s)がモックなしで元に戻る',
    async (_name: string, block: model.Block): Promise<void> => {
      compressSpy.mockImplementationOnce(actualCompress);
      decompressSpy.mockImplementationOnce(actualDecompress);

      const stored = await blockService.deflateBlock(block);
      await expect(blockService.inflateJson(stored, 1)).resolves.toStrictEqual(
        block,
      );
    },
  );
});

describe('blockService import/export', (): void => {
  let getAllBlockSpy: jest.SpyInstance;
  let getTabLengthSpy: jest.SpyInstance;
  let setBlockSpy: jest.SpyInstance;
  let setTabLengthSpy: jest.SpyInstance;
  const reload = jest.fn();

  beforeEach(() => {
    getAllBlockSpy = jest.spyOn(chromeService.storage, 'getAllBlock');
    getTabLengthSpy = jest
      .spyOn(chromeService.storage, 'getTabLength')
      .mockResolvedValue(3);
    setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    setTabLengthSpy = jest
      .spyOn(chromeService.storage, 'setTabLength')
      .mockResolvedValue(undefined);
    reload.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      tabs: { reload: reload },
      // 置換文字列（件数など）まで検証できるよう、substitutionsも文字列に含める
      i18n: {
        getMessage: (key: string, substitutions?: string[]): string =>
          substitutions == null
            ? key
            : `${key}:${JSON.stringify(substitutions)}`,
      },
    };
  });

  afterEach(() => {
    getAllBlockSpy.mockRestore();
    getTabLengthSpy.mockRestore();
    setBlockSpy.mockRestore();
    setTabLengthSpy.mockRestore();
  });

  // エクスポート版数を上げたときにインポート側の受け入れ追加を忘れると、
  // 自分が出力したJSONを読めなくなる
  test('エクスポートした版数はインポートで受け付けられる', (): void => {
    expect(blockService.SUPPORTED_EXPORT_VERSIONS).toContain(
      blockService.CURRENT_EXPORT_VERSION,
    );
  });

  // 保存側がv3になってもエクスポート形式はv2から変わらない。ここでv3を出すと
  // 旧バージョンの拡張機能でインポートできなくなるだけなので据え置く
  test('exportAllDataJson バージョン情報付きで出力する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [
          {
            url: 'https://example.com/test',
            title: 'title-test',
          },
        ],
      },
    ]);
    await expect(blockService.exportAllDataJson()).resolves.toStrictEqual({
      json: '{"v":2,"ev":"9.9.9","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}',
      brokenCount: 0,
    });
  });

  // 復元できなかったブロックはブロックJSONに戻せないため出力できない。
  // 正常なブロックがそれに巻き込まれて欠けないことを担保する
  test('exportAllDataJson 復元できなかったブロックは除いて出力し件数を返す', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [
          {
            url: 'https://example.com/test',
            title: 'title-test',
          },
        ],
      },
      { indexNum: 1, broken: true, unsupported: false },
      { indexNum: 2, broken: true, unsupported: true },
    ]);

    await expect(blockService.exportAllDataJson()).resolves.toStrictEqual({
      json: '{"v":2,"ev":"9.9.9","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}',
      brokenCount: 2,
    });
  });

  // エクスポートは成功しているため、赤バッジ+アラートのerrorLogには流さない
  // （欠損の通知はユーザー操作への応答としてSideBar側でalertする）
  test('exportAllDataJson 欠損があってもerrorLogには流さない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      { indexNum: 0, broken: true, unsupported: false },
    ]);
    const errorLogSetSpy = jest
      .spyOn(chromeService.errorLog, 'set')
      .mockResolvedValue(undefined);

    try {
      await blockService.exportAllDataJson();
      expect(errorLogSetSpy).not.toHaveBeenCalled();
    } finally {
      errorLogSetSpy.mockRestore();
    }
  });

  test('importAllDataJson v2形式', async (): Promise<void> => {
    const json =
      '{"v":2,"ev":"0.3.0","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}';

    await blockService.importAllDataJson(json);
    expect(setBlockSpy).toHaveBeenCalledTimes(1);
    expect(setBlockSpy.mock.calls[0][0]).toStrictEqual({
      indexNum: 3,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    });
    expect(setTabLengthSpy).toHaveBeenCalledWith(4);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // エクスポートJSONのブロックはjsonToBlockではなくjsonObjToBlock経由で
  // 読むため、名前の往復を別に担保する
  test('importAllDataJson ブロック名を引き継ぐ', async (): Promise<void> => {
    const json =
      '{"v":2,"ev":"0.7.0","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}],"title":"調査中のタブ"}]}';

    await blockService.importAllDataJson(json);
    expect(setBlockSpy.mock.calls[0][0]).toStrictEqual({
      indexNum: 3,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
      title: '調査中のタブ',
    });
  });

  test('importAllDataJson v1形式(バージョン表記なしの素の配列)', async (): Promise<void> => {
    const json =
      '[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]';

    await blockService.importAllDataJson(json);
    expect(setBlockSpy).toHaveBeenCalledTimes(1);
    expect(setBlockSpy.mock.calls[0][0]).toStrictEqual({
      indexNum: 3,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [
        {
          url: 'https://example.com/test',
          title: 'title-test',
        },
      ],
    });
    expect(setTabLengthSpy).toHaveBeenCalledWith(4);
  });

  test('importAllDataJson 未対応バージョンはエラー', async (): Promise<void> => {
    await expect(
      blockService.importAllDataJson('{"v":99,"blocks":[]}'),
    ).rejects.toThrow('Unsupported data version: v=99');
    expect(setBlockSpy).not.toHaveBeenCalled();
    expect(setTabLengthSpy).not.toHaveBeenCalled();
  });

  // 途中まで書き込んだ状態でsetTabLengthに到達すると、書き込んだブロックが
  // 一覧に出ないまま次回保存で上書きされるため、書き込む前に弾く
  test.each([
    ['blocksが配列でない', '{"v":2,"blocks":"oops"}'],
    [
      'tabsがないブロックが混ざっている',
      '{"v":2,"blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/a","title":"a"}]},{"created_at":1609556645678}]}',
    ],
    [
      'tabsが配列でないブロックが混ざっている',
      '{"v":2,"blocks":[{"created_at":1609556645678,"tabs":"oops"}]}',
    ],
  ])(
    'importAllDataJson 書き込めないデータ(%s)は1件も書き込まずエラーにする',
    async (_name: string, json: string): Promise<void> => {
      await expect(blockService.importAllDataJson(json)).rejects.toThrow(
        /^Invalid data:/,
      );
      expect(setBlockSpy).not.toHaveBeenCalled();
      expect(setTabLengthSpy).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    },
  );
});

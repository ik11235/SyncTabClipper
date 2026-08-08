/**
 * @jest-environment jsdom
 */
import { blockService } from './blockService';
import { chromeService } from './chromeService';
import { zlibWrapper } from './zlib-wrapper';

let deflateSpy: jest.SpyInstance;
let inflateSpy: jest.SpyInstance;
let versionSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeAll(() => {
  deflateSpy = jest.spyOn(zlibWrapper, 'deflate');
  inflateSpy = jest.spyOn(zlibWrapper, 'inflate');
  versionSpy = jest.spyOn(chromeService.runtime, 'getExtensionVersion');
});

beforeEach(() => {
  versionSpy.mockReturnValue('9.9.9');
  // 壊れたタブ要素のスキップはconsole.warnに出るため、テスト出力を汚さないよう抑制する
  warnSpy = jest.spyOn(console, 'warn').mockImplementation((): void => {});
});

afterEach(() => {
  deflateSpy.mockReset();
  inflateSpy.mockReset();
  versionSpy.mockReset();
  warnSpy.mockRestore();
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

  // 読み込みが確定していないタブのurlは空文字列になりうる。
  // 空のurlを保存すると開き直せないタブになるため、pendingUrlで補う
  test('createBlock urlが空のタブはpendingUrlで補う', (): void => {
    const baseTab = {
      index: 0,
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
    };
    const tabs: chrome.tabs.Tab[] = [
      {
        ...baseTab,
        title: 'pending',
        url: '',
        pendingUrl: 'https://example.com/pending',
      },
      { ...baseTab, index: 1, url: '' },
    ];

    const res = blockService.createBlock(
      tabs,
      new Date(`2021-01-02T03:04:05.678Z`),
      1,
    );

    expect(res.tabs).toStrictEqual([
      { url: 'https://example.com/pending', title: 'pending' },
      { url: '', title: '' },
    ]);
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

  test('deflateBlock 非圧縮時', (): void => {
    deflateSpy.mockReturnValueOnce(
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
      '{"v":2,"ev":"9.9.9","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}';
    expect(blockService.deflateBlock(block)).toBe(expected);
    expect(deflateSpy.mock.calls[0]).toEqual([
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}',
    ]);
    expect(deflateSpy).toHaveBeenCalledTimes(1);
  });

  test('deflateBlock 圧縮時', (): void => {
    deflateSpy.mockReturnValueOnce(
      'eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w==',
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
      '{"v":2,"ev":"9.9.9","d":"eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w=="}';
    expect(blockService.deflateBlock(block)).toBe(expected);
    expect(deflateSpy.mock.calls[0]).toEqual([
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"},{"url":"http://google.com/test2","title":"google-test"},{"url":"http://google.com/test3","title":"google-test33"},{"url":"http://google.com/test4","title":"google-test44"}]}',
    ]);
    expect(deflateSpy).toHaveBeenCalledTimes(1);
  });

  test('inflateJson v1非圧縮データ(バージョン表記なし)', (): void => {
    inflateSpy.mockReturnValueOnce(
      '{"created_at":1627200615501,"tabs":[{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome://extensions/","title":"拡張機能"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"},{"url":"chrome://newtab/","title":"新しいタブ"},{"url":"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html","title":"SyncTabClipper"}]}',
    );

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
    expect(blockService.inflateJson(input, indexNum)).toStrictEqual(expected);
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson v1圧縮データ(バージョン表記なし)', (): void => {
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
    expect(blockService.inflateJson(input, indexNum)).toStrictEqual(expected);
    expect(inflateSpy.mock.calls[0]).toEqual([
      'eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w==',
    ]);

    expect(inflateSpy).toHaveBeenCalledTimes(1);
  });

  test('inflateJson v2非圧縮データ', (): void => {
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
    expect(blockService.inflateJson(input, 1)).toStrictEqual(expected);
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson v2圧縮データ', (): void => {
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
    expect(blockService.inflateJson(input, 1)).toStrictEqual(expected);
    expect(inflateSpy.mock.calls[0]).toEqual(['compressed-data']);
    expect(inflateSpy).toHaveBeenCalledTimes(1);
  });

  test('inflateJson 未対応バージョンはエラー(圧縮)', (): void => {
    const input = '{"v":99,"ev":"99.0.0","d":"compressed-data"}';
    expect(() => blockService.inflateJson(input, 1)).toThrow(
      'Unsupported data version: v=99',
    );
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  test('inflateJson 未対応バージョンはエラー(非圧縮)', (): void => {
    const input =
      '{"v":99,"ev":"99.0.0","created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}';
    expect(() => blockService.inflateJson(input, 1)).toThrow(
      'Unsupported data version: v=99',
    );
    expect(inflateSpy).toHaveBeenCalledTimes(0);
  });

  // JSONとしてparseできるだけの壊れたデータを通すと、描画時に例外になり
  // 一覧全体が表示されなくなるため、inflateJsonの時点で弾く
  test.each([
    ['tabsが欠落', '{"created_at":1609556645678}'],
    [
      'created_atが欠落',
      '{"tabs":[{"url":"https://example.com/","title":"t"}]}',
    ],
    ['created_atが数値でない', '{"created_at":"x","tabs":[]}'],
    ['created_atが有限数でない', '{"created_at":null,"tabs":[]}'],
    // Dateの表現範囲(±8.64e15)外はInvalid Dateになり、描画時の
    // toISOString()でRangeErrorになる
    ['created_atがDateの範囲を超える', '{"created_at":1e20,"tabs":[]}'],
    ['created_atがDateの範囲を下回る', '{"created_at":-1e20,"tabs":[]}'],
    ['配列', '[]'],
    ['数値', '123'],
    ['文字列JSON', '"foo"'],
    ['null', 'null'],
    ['tabsが配列でない', '{"created_at":1609556645678,"tabs":{}}'],
    ['圧縮データのdが文字列でない', '{"v":2,"d":123}'],
  ])('inflateJson %s はエラー', (_name: string, input: string): void => {
    expect(() => blockService.inflateJson(input, 1)).toThrow(
      /^Invalid (block|export) data:/,
    );
  });

  // タブ1件の破損でブロックごと捨てると、同じブロックの正常なタブまで
  // 一覧から消える。ブロックは残し、壊れた要素だけを落とす
  test.each([
    ['要素がnull', '[null,{"url":"https://example.com/","title":"t"}]'],
    ['要素が数値', '[1,{"url":"https://example.com/","title":"t"}]'],
    [
      '要素にurlがない',
      '[{"title":"no-url"},{"url":"https://example.com/","title":"t"}]',
    ],
  ])(
    'inflateJson tabsの壊れた要素(%s)は落としてブロックは残す',
    (_name: string, tabsJson: string): void => {
      const input = `{"created_at":1609556645678,"tabs":${tabsJson}}`;
      expect(blockService.inflateJson(input, 1)).toStrictEqual({
        indexNum: 1,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [{ url: 'https://example.com/', title: 't' }],
      });
    },
  );

  // titleは欠けていてもタブを開き直せるので、空文字列で補って残す
  test('inflateJson tabsの要素にtitleがない場合は空文字で補う', (): void => {
    const input =
      '{"created_at":1609556645678,"tabs":[{"url":"https://example.com/"}]}';
    expect(blockService.inflateJson(input, 1)).toStrictEqual({
      indexNum: 1,
      createdAt: new Date(`2021-01-02T03:04:05.678Z`),
      tabs: [{ url: 'https://example.com/', title: '' }],
    });
  });
});

describe('blockService import/export', (): void => {
  let getAllBlockSpy: jest.SpyInstance;
  let getAllBlockWithBrokenKeysSpy: jest.SpyInstance;
  let getTabLengthSpy: jest.SpyInstance;
  let setBlockSpy: jest.SpyInstance;
  let setTabLengthSpy: jest.SpyInstance;
  let errorLogSetSpy: jest.SpyInstance;
  const reload = jest.fn();

  beforeEach(() => {
    getAllBlockSpy = jest.spyOn(chromeService.storage, 'getAllBlock');
    getAllBlockWithBrokenKeysSpy = jest.spyOn(
      chromeService.storage,
      'getAllBlockWithBrokenKeys',
    );
    getTabLengthSpy = jest
      .spyOn(chromeService.storage, 'getTabLength')
      .mockResolvedValue(3);
    setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    setTabLengthSpy = jest
      .spyOn(chromeService.storage, 'setTabLength')
      .mockResolvedValue(undefined);
    errorLogSetSpy = jest
      .spyOn(chromeService.errorLog, 'set')
      .mockResolvedValue(undefined);
    reload.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      tabs: { reload: reload },
      i18n: {
        // 実際のメッセージ本文ではなく、キーと置換値の受け渡しを検証する
        getMessage: (key: string, substitutions?: string[]): string =>
          `${key}:${(substitutions ?? []).join(',')}`,
      },
    };
  });

  afterEach(() => {
    getAllBlockSpy.mockRestore();
    getAllBlockWithBrokenKeysSpy.mockRestore();
    getTabLengthSpy.mockRestore();
    setBlockSpy.mockRestore();
    setTabLengthSpy.mockRestore();
    errorLogSetSpy.mockRestore();
  });

  const exportBlock = {
    indexNum: 0,
    createdAt: new Date(`2021-01-02T03:04:05.678Z`),
    tabs: [
      {
        url: 'https://example.com/test',
        title: 'title-test',
      },
    ],
  };

  test('exportAllDataJson バージョン情報付きで出力する', async (): Promise<void> => {
    getAllBlockWithBrokenKeysSpy.mockResolvedValue({
      blocks: [exportBlock],
      brokenKeys: [],
    });
    await expect(blockService.exportAllDataJson()).resolves.toBe(
      '{"v":2,"ev":"9.9.9","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}',
    );
  });

  // 壊れたブロックが黙って欠けたバックアップは、全データ削除後のimportで
  // 復旧不能になる。かといって失敗させるとバックアップを取る手段自体がなくなるため、
  // 欠けたkeyをJSONに明記し、警告を通知したうえで成功させる
  test('exportAllDataJson 壊れたブロックがある場合はbroken_keys付きで出力し警告する', async (): Promise<void> => {
    getAllBlockWithBrokenKeysSpy.mockResolvedValue({
      blocks: [exportBlock],
      brokenKeys: ['td_1', 'td_3'],
    });

    await expect(blockService.exportAllDataJson()).resolves.toBe(
      '{"v":2,"ev":"9.9.9","broken_keys":["td_1","td_3"],"blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}',
    );
    expect(errorLogSetSpy).toHaveBeenCalledWith(
      'content_msg_export_broken_block:td_1, td_3',
    );
  });

  // 通知の失敗でバックアップが取れなくなるほうが害が大きい
  test('exportAllDataJson 警告の通知に失敗してもエクスポートは成功する', async (): Promise<void> => {
    getAllBlockWithBrokenKeysSpy.mockResolvedValue({
      blocks: [exportBlock],
      brokenKeys: ['td_1'],
    });
    errorLogSetSpy.mockRejectedValue(new Error('quota exceeded'));

    await expect(blockService.exportAllDataJson()).resolves.toContain(
      '"broken_keys":["td_1"]',
    );
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
});

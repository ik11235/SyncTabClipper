/**
 * @jest-environment jsdom
 */
import { blockService } from './blockService';
import { chromeService } from './chromeService';
import { zlibWrapper } from './zlib-wrapper';

let deflateSpy: jest.SpyInstance;
let inflateSpy: jest.SpyInstance;
let versionSpy: jest.SpyInstance;

beforeAll(() => {
  deflateSpy = jest.spyOn(zlibWrapper, 'deflate');
  inflateSpy = jest.spyOn(zlibWrapper, 'inflate');
  versionSpy = jest.spyOn(chromeService.runtime, 'getExtensionVersion');
});

beforeEach(() => {
  versionSpy.mockReturnValue('9.9.9');
});

afterEach(() => {
  deflateSpy.mockReset();
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
      i18n: { getMessage: (key: string): string => key },
    };
  });

  afterEach(() => {
    getAllBlockSpy.mockRestore();
    getTabLengthSpy.mockRestore();
    setBlockSpy.mockRestore();
    setTabLengthSpy.mockRestore();
  });

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
    await expect(blockService.exportAllDataJson()).resolves.toBe(
      '{"v":2,"ev":"9.9.9","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}',
    );
  });

  // 復元できなかったブロックはブロックJSONに戻せないため出力できない。
  // 正常なブロックがそれに巻き込まれて欠けないことを担保する
  test('exportAllDataJson 復元できなかったブロックは除いて出力し欠損を通知する', async (): Promise<void> => {
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
      { indexNum: 1, broken: true },
    ]);
    const errorLogSetSpy = jest
      .spyOn(chromeService.errorLog, 'set')
      .mockResolvedValue(undefined);

    try {
      await expect(blockService.exportAllDataJson()).resolves.toBe(
        '{"v":2,"ev":"9.9.9","blocks":[{"created_at":1609556645678,"tabs":[{"url":"https://example.com/test","title":"title-test"}]}]}',
      );
      // 欠けたバックアップを完全なものと誤解させないため件数を通知する
      expect(errorLogSetSpy).toHaveBeenCalledWith(
        'content_msg_export_broken_block',
      );
    } finally {
      errorLogSetSpy.mockRestore();
    }
  });

  test('exportAllDataJson 全ブロックが正常なら通知しない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date(`2021-01-02T03:04:05.678Z`),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
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

  test('exportAllDataJson 欠損の通知に失敗してもエクスポートは成功する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([{ indexNum: 0, broken: true }]);
    const errorLogSetSpy = jest
      .spyOn(chromeService.errorLog, 'set')
      .mockRejectedValue(new Error('storage error'));
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(blockService.exportAllDataJson()).resolves.toBe(
        '{"v":2,"ev":"9.9.9","blocks":[]}',
      );
    } finally {
      errorLogSetSpy.mockRestore();
      consoleErrorSpy.mockRestore();
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

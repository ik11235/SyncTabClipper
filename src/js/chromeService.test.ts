import { chromeService } from './chromeService';

describe('chromeService.storage.getAllBlock', (): void => {
  let syncData: { [key: string]: string };
  let localData: { [key: string]: string };
  const setBadgeText = jest.fn();
  const setBadgeBackgroundColor = jest.fn();

  const pickData = (
    data: { [key: string]: string },
    keys: string[],
  ): Promise<{ [key: string]: string }> => {
    const res: { [key: string]: string } = {};
    for (const key of keys) {
      const value = data[key];
      if (value != null) {
        res[key] = value;
      }
    }
    return Promise.resolve(res);
  };

  beforeEach((): void => {
    syncData = {};
    localData = {};
    setBadgeText.mockClear();
    setBadgeBackgroundColor.mockClear();
    jest.spyOn(console, 'error').mockImplementation((): void => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {},
      i18n: {
        // 実際のメッセージ本文ではなく、キーと置換値の受け渡しを検証する
        getMessage: (key: string, substitutions?: string[]): string =>
          `${key}:${(substitutions ?? []).join(',')}`,
      },
      storage: {
        sync: {
          get: (keys: string[]): Promise<{ [key: string]: string }> =>
            pickData(syncData, keys),
        },
        local: {
          set: (obj: { [key: string]: string }): Promise<void> => {
            Object.assign(localData, obj);
            return Promise.resolve();
          },
          get: (keys: string[]): Promise<{ [key: string]: string }> =>
            pickData(localData, keys),
        },
      },
      action: {
        setBadgeText: setBadgeText,
        setBadgeBackgroundColor: setBadgeBackgroundColor,
      },
    };
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  const blockJson = (createdAt: number): string =>
    JSON.stringify({
      created_at: createdAt,
      tabs: [{ url: 'https://example.com/', title: 'example' }],
    });

  test('全ブロックが正常な場合は全件返る', async (): Promise<void> => {
    syncData['t_len'] = '2';
    syncData['td_0'] = blockJson(1000);
    syncData['td_1'] = blockJson(2000);

    const blocks = await chromeService.storage.getAllBlock();

    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.indexNum)).toEqual([1, 0]);
    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
  });

  test.each([
    ['JSONとしても圧縮データとしても解釈できない', 'broken-data-not-json'],
    ['tabsが欠落している', JSON.stringify({ created_at: 1000 })],
    [
      'created_atが欠落している',
      JSON.stringify({ tabs: [{ url: 'https://example.com/', title: 'e' }] }),
    ],
    ['created_atが数値でない', JSON.stringify({ created_at: 'x', tabs: [] })],
    ['created_atがDateの範囲を超える', '{"created_at":1e20,"tabs":[]}'],
    ['空文字列である', ''],
    ['オブジェクトでない（配列）', '[]'],
    ['オブジェクトでない（数値）', '123'],
    ['nullである', 'null'],
  ])(
    '1件が%sデータでも残りのブロックが返る',
    async (_name: string, broken: string): Promise<void> => {
      syncData['t_len'] = '3';
      syncData['td_0'] = blockJson(1000);
      syncData['td_1'] = broken;
      syncData['td_2'] = blockJson(3000);

      const blocks = await chromeService.storage.getAllBlock();

      expect(blocks).toHaveLength(2);
      expect(blocks.map((b) => b.indexNum)).toEqual([2, 0]);
      expect(localData[chromeService.errorLog.errorKey]).toBe(
        'content_msg_broken_block:td_1',
      );
      expect(setBadgeText).toHaveBeenCalledWith({ text: '!' });
    },
  );

  // 削除済みブロックはkey自体が存在しない。正常な状態なので通知してはいけない
  test('keyが存在しないブロックは通知されない', async (): Promise<void> => {
    syncData['t_len'] = '3';
    syncData['td_0'] = blockJson(1000);
    syncData['td_2'] = blockJson(3000);

    const blocks = await chromeService.storage.getAllBlock();

    expect(blocks.map((b) => b.indexNum)).toEqual([2, 0]);
    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
  });

  // タブ1件が壊れていても、同じブロックの残りのタブは一覧に残す
  test('tabsの要素がTabになっていないブロックは壊れた要素だけを落として残る', async (): Promise<void> => {
    jest.spyOn(console, 'warn').mockImplementation((): void => {});
    syncData['t_len'] = '1';
    syncData['td_0'] = JSON.stringify({
      created_at: 1000,
      tabs: [null, { url: 'https://example.com/', title: 'example' }],
    });

    const blocks = await chromeService.storage.getAllBlock();

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.tabs).toStrictEqual([
      { url: 'https://example.com/', title: 'example' },
    ]);
    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
  });

  test('getAllBlockWithBrokenKeysは壊れたkeyを呼び出し側に返す', async (): Promise<void> => {
    syncData['t_len'] = '3';
    syncData['td_0'] = blockJson(1000);
    syncData['td_1'] = 'broken-data-not-json';
    syncData['td_2'] = '';

    const result = await chromeService.storage.getAllBlockWithBrokenKeys();

    expect(result.blocks.map((b) => b.indexNum)).toEqual([0]);
    expect(result.brokenKeys).toEqual(['td_1', 'td_2']);
  });

  // 通知はgetAllBlock側の責務。ここで通知すると、エクスポート失敗時の通知と
  // 二重に発火してどちらが表示されるかがレースで決まってしまう
  test('getAllBlockWithBrokenKeysは通知しない', async (): Promise<void> => {
    syncData['t_len'] = '2';
    syncData['td_0'] = blockJson(1000);
    syncData['td_1'] = 'broken-data-not-json';

    await chromeService.storage.getAllBlockWithBrokenKeys();

    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    expect(setBadgeText).not.toHaveBeenCalled();
  });

  test('複数件壊れている場合は全てのkeyが通知される', async (): Promise<void> => {
    syncData['t_len'] = '3';
    syncData['td_0'] = 'broken-data-not-json';
    syncData['td_1'] = blockJson(1000);
    syncData['td_2'] = 'null';

    const blocks = await chromeService.storage.getAllBlock();

    expect(blocks.map((b) => b.indexNum)).toEqual([1]);
    expect(localData[chromeService.errorLog.errorKey]).toBe(
      'content_msg_broken_block:td_0, td_2',
    );
  });

  test('未確認の先行エラーがある場合は上書きしない', async (): Promise<void> => {
    localData[chromeService.errorLog.errorKey] = 'previous error';
    syncData['t_len'] = '2';
    syncData['td_0'] = blockJson(1000);
    syncData['td_1'] = 'broken-data-not-json';

    const blocks = await chromeService.storage.getAllBlock();

    expect(blocks).toHaveLength(1);
    expect(localData[chromeService.errorLog.errorKey]).toBe('previous error');
  });

  test('エラー通知の保存に失敗してもgetAllBlockは残りのブロックを返す', async (): Promise<void> => {
    syncData['t_len'] = '2';
    syncData['td_0'] = blockJson(1000);
    syncData['td_1'] = 'broken-data-not-json';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome.storage.local.set = (): Promise<void> =>
      Promise.reject(new Error('quota exceeded'));

    const blocks = await chromeService.storage.getAllBlock();

    expect(blocks).toHaveLength(1);
    expect(blocks.map((b) => b.indexNum)).toEqual([0]);
  });
});

describe('chromeService.errorLog', (): void => {
  let localData: { [key: string]: string };
  const setBadgeText = jest.fn();
  const setBadgeBackgroundColor = jest.fn();

  beforeEach((): void => {
    localData = {};
    setBadgeText.mockClear();
    setBadgeBackgroundColor.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {},
      storage: {
        local: {
          set: (obj: { [key: string]: string }): Promise<void> => {
            Object.assign(localData, obj);
            return Promise.resolve();
          },
          get: (keys: string[]): Promise<{ [key: string]: string }> => {
            const res: { [key: string]: string } = {};
            for (const key of keys) {
              const value = localData[key];
              if (value != null) {
                res[key] = value;
              }
            }
            return Promise.resolve(res);
          },
          remove: (key: string): Promise<void> => {
            delete localData[key];
            return Promise.resolve();
          },
        },
      },
      action: {
        setBadgeText: setBadgeText,
        setBadgeBackgroundColor: setBadgeBackgroundColor,
      },
    };
  });

  test('setでエラーが保存されバッジが立つ', async (): Promise<void> => {
    await chromeService.errorLog.set('boom');

    expect(localData[chromeService.errorLog.errorKey]).toBe('boom');
    expect(setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#DD2222' });
  });

  test('setにErrorインスタンスを渡すとmessageが保存される', async (): Promise<void> => {
    await chromeService.errorLog.set(new Error('boom'));

    expect(localData[chromeService.errorLog.errorKey]).toBe('boom');
  });

  test('getで取得しても保存とバッジは残る', async (): Promise<void> => {
    await chromeService.errorLog.set('boom');
    setBadgeText.mockClear();

    await expect(chromeService.errorLog.get()).resolves.toBe('boom');
    expect(localData[chromeService.errorLog.errorKey]).toBe('boom');
    expect(setBadgeText).not.toHaveBeenCalled();
  });

  test('未保存時のgetはnullを返す', async (): Promise<void> => {
    await expect(chromeService.errorLog.get()).resolves.toBeNull();
  });

  test('storage失敗時はErrorインスタンスでrejectしバッジは立たない', async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome.storage.local.set = (): Promise<void> => {
      return Promise.reject(new Error('quota exceeded'));
    };

    const result = chromeService.errorLog.set('boom');
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toThrow('quota exceeded');
    expect(setBadgeText).not.toHaveBeenCalled();
  });

  test('clearで保存とバッジが消える', async (): Promise<void> => {
    await chromeService.errorLog.set('boom');
    await chromeService.errorLog.clear();

    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    expect(setBadgeText).toHaveBeenLastCalledWith({ text: '' });
  });
});

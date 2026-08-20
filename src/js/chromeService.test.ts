/**
 * @jest-environment jsdom
 *
 * getAllBlockはブラウザ上で動くコードで、復元処理(inflateJson/zlibWrapper)も
 * 実データで通す。node環境との差異で実挙動と乖離しないようjsdomで検証する
 */
import { chromeService } from './chromeService';
import { blockService } from './blockService';

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

describe('chromeService.storage.getAllBlock', (): void => {
  let syncData: { [key: string]: string };
  let consoleErrorSpy: jest.SpyInstance;

  // 正常に復元できる非圧縮v2ブロックのJSON
  const validJson = (createdAt: number, title: string): string =>
    JSON.stringify({
      v: 2,
      ev: '9.9.9',
      created_at: createdAt,
      tabs: [{ url: `https://example.com/${title}`, title: title }],
    });

  beforeEach((): void => {
    syncData = {};
    // 復元失敗の内容はconsole.errorに出るため、テスト出力を汚さないよう抑止する
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      storage: {
        sync: {
          get: (keys: string[]): Promise<{ [key: string]: string }> => {
            const res: { [key: string]: string } = {};
            for (const key of keys) {
              const value = syncData[key];
              if (value != null) {
                res[key] = value;
              }
            }
            return Promise.resolve(res);
          },
        },
      },
    };
  });

  afterEach((): void => {
    consoleErrorSpy.mockRestore();
  });

  test('全ブロックが正常なら作成日の降順で全件返る', async (): Promise<void> => {
    syncData['t_len'] = '2';
    syncData['td_0'] = validJson(1609556645678, 'old');
    syncData['td_1'] = validJson(1640000000000, 'new');

    const res = await chromeService.storage.getAllBlock();

    expect(res).toHaveLength(2);
    expect(res.map((entry) => entry.indexNum)).toEqual([1, 0]);
    expect(res.some((entry) => blockService.isBrokenBlock(entry))).toBe(false);
  });

  // 1件の壊れたデータで一覧全体が失われないことの回帰テスト(#192)
  test.each([
    ['JSONとして壊れている', '{"v":2,"created_at":1', false],
    ['未対応バージョン', '{"v":99,"created_at":1609556645678,"tabs":[]}', true],
    ['空文字列(書き込みが壊れた形跡)', '', false],
    ['tabsがない', '{"v":2,"created_at":1609556645678}', false],
    [
      'tabsが配列でない',
      '{"v":2,"created_at":1609556645678,"tabs":"oops"}',
      false,
    ],
    // v3の圧縮ペイロードが壊れている場合。DecompressionStreamのrejectが
    // BrokenBlockに落ちること（=呼び出し側をすり抜けないこと）を担保する
    ['v3のdがbase64として壊れている', '{"v":3,"d":"!!!not base64!!!"}', false],
    ['v3のdがdeflateデータでない', '{"v":3,"d":"bm90IGEgZGVmbGF0ZQ=="}', false],
    ['v3のdが途中で切れている', '{"v":3,"d":"q1ZKLkpNLElNiU8s"}', false],
  ])(
    '1件が復元できない(%s)場合もBrokenBlockとして返り他のブロックは残る',
    async (
      _name: string,
      brokenValue: string,
      unsupported: boolean,
    ): Promise<void> => {
      syncData['t_len'] = '2';
      syncData['td_0'] = brokenValue;
      syncData['td_1'] = validJson(1640000000000, 'valid');

      const res = await chromeService.storage.getAllBlock();

      expect(res).toHaveLength(2);
      // BrokenBlockはcreatedAtが分からないため末尾に並ぶ
      expect(res[0]).toStrictEqual({
        indexNum: 1,
        createdAt: new Date(1640000000000),
        tabs: [{ url: 'https://example.com/valid', title: 'valid' }],
      });
      // 新しいバージョンで保存されただけのデータは、壊れたデータと区別する
      // （削除導線を出すと全同期端末から実データが消えるため）
      expect(res[1]).toStrictEqual({
        indexNum: 0,
        broken: true,
        unsupported: unsupported,
      });
    },
  );

  test('復元できないブロックが複数あってもすべてBrokenBlockとして返る', async (): Promise<void> => {
    syncData['t_len'] = '3';
    syncData['td_0'] = '{"v":2,"created_at":1';
    syncData['td_1'] = validJson(1640000000000, 'valid');
    syncData['td_2'] = '';

    const res = await chromeService.storage.getAllBlock();

    expect(res).toHaveLength(3);
    expect(res.filter((entry) => blockService.isBrokenBlock(entry))).toEqual([
      { indexNum: 0, broken: true, unsupported: false },
      { indexNum: 2, broken: true, unsupported: false },
    ]);
  });

  // 作成日が壊れていてもタブ自体は読めるので、ブロックごと捨てずに残す。
  // Invalid Dateのまま返すとblock.tsxのtoISOString()がRangeErrorになり、
  // compareBlockEntryの比較結果もNaNで非一貫になる
  test('created_atがDateの表現範囲外でもタブを保ったまま返る', async (): Promise<void> => {
    syncData['t_len'] = '1';
    syncData['td_0'] =
      '{"v":2,"created_at":1e20,"tabs":[{"url":"https://example.com/keep","title":"keep"}]}';

    const res = await chromeService.storage.getAllBlock();

    expect(res).toStrictEqual([
      {
        indexNum: 0,
        createdAt: new Date(0),
        tabs: [{ url: 'https://example.com/keep', title: 'keep' }],
      },
    ]);
  });

  test('keyが存在しないブロックは削除済みとして一覧に含めない', async (): Promise<void> => {
    syncData['t_len'] = '2';
    syncData['td_1'] = validJson(1640000000000, 'valid');

    const res = await chromeService.storage.getAllBlock();

    expect(res).toStrictEqual([
      {
        indexNum: 1,
        createdAt: new Date(1640000000000),
        tabs: [{ url: 'https://example.com/valid', title: 'valid' }],
      },
    ]);
  });
});

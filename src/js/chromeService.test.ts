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
          // 実際のchrome.storage.syncと同じく、nullを渡されたら全キーを返す
          get: (keys: string[] | null): Promise<{ [key: string]: string }> => {
            if (keys == null) {
              return Promise.resolve({ ...syncData });
            }
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

  // t_lenは採番カウンタでしかなく、書き込み失敗や旧形式で壊れうる。
  // これを走査範囲にしていたころは、getTabLengthの例外がapp.tsxの.catchへ
  // 落ちて一覧が丸ごと表示されなくなっていた(#229)
  test.each([
    ['数値にできない値', 'broken'],
    ['空文字列', ''],
    ['負の数', '-3'],
    ['実データより小さい', '1'],
    ['実データより大きい', '99'],
  ])(
    't_lenが%sでも保存されているブロックは全件返る',
    async (_name: string, tabLength: string): Promise<void> => {
      syncData['t_len'] = tabLength;
      syncData['td_0'] = validJson(1609556645678, 'old');
      syncData['td_1'] = validJson(1640000000000, 'new');

      const res = await chromeService.storage.getAllBlock();

      expect(res.map((entry) => entry.indexNum)).toEqual([1, 0]);
    },
  );

  test('t_lenが保存されていなくてもブロックは全件返る', async (): Promise<void> => {
    syncData['td_0'] = validJson(1609556645678, 'old');
    syncData['td_1'] = validJson(1640000000000, 'new');

    const res = await chromeService.storage.getAllBlock();

    expect(res.map((entry) => entry.indexNum)).toEqual([1, 0]);
  });

  test('ブロック以外のキーは一覧に含めない', async (): Promise<void> => {
    syncData['t_len'] = '1';
    syncData['error'] = 'boom';
    syncData['td_x'] = validJson(1609556645678, 'notablock');
    syncData['td_0'] = validJson(1640000000000, 'valid');

    const res = await chromeService.storage.getAllBlock();

    expect(res.map((entry) => entry.indexNum)).toEqual([0]);
  });
});

describe('chromeService.storage.getNextBlockIndex', (): void => {
  let syncData: { [key: string]: string };

  beforeEach((): void => {
    syncData = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      storage: {
        sync: {
          get: (keys: string[] | null): Promise<{ [key: string]: string }> => {
            if (keys == null) {
              return Promise.resolve({ ...syncData });
            }
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

  test('1件も保存されていなければ0を返す', async (): Promise<void> => {
    syncData['t_len'] = '5';

    expect(await chromeService.storage.getNextBlockIndex()).toBe(0);
  });

  test('保存済みindexの最大値+1を返す', async (): Promise<void> => {
    syncData['td_0'] = 'dummy';
    syncData['td_1'] = 'dummy';

    expect(await chromeService.storage.getNextBlockIndex()).toBe(2);
  });

  // 削除でindexに穴が空いてもt_lenは減らないため、
  // 欠番をまたいで最大値を見ないと既存ブロックを上書きしてしまう
  test('欠番があっても既存のindexを再利用しない', async (): Promise<void> => {
    syncData['td_0'] = 'dummy';
    syncData['td_3'] = 'dummy';

    expect(await chromeService.storage.getNextBlockIndex()).toBe(4);
  });

  // t_lenの外側に取り残されたブロックを上書きしないことの回帰テスト(#232)
  test('t_lenが実データより小さくても上書きしないindexを返す', async (): Promise<void> => {
    syncData['t_len'] = '1';
    syncData['td_0'] = 'dummy';
    syncData['td_1'] = 'dummy';
    syncData['td_2'] = 'dummy';

    expect(await chromeService.storage.getNextBlockIndex()).toBe(3);
  });
});

describe('chromeService.tab.createTabsPageTab', (): void => {
  const tabsPageUrl = 'chrome-extension://abc/tabs.html';
  // アイコンを押したウィンドウ。ここのタブはこれから閉じられるため、
  // tabsページはこのウィンドウへ引き取る必要がある
  const CLICKED_WINDOW_ID = 1;
  let openedTabs: chrome.tabs.Tab[];
  const create = jest.fn();
  const update = jest.fn();
  const move = jest.fn();
  const updateWindow = jest.fn();

  beforeEach((): void => {
    openedTabs = [];
    create.mockClear();
    update.mockClear();
    move.mockClear();
    updateWindow.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {
        getURL: (path: string): string => `chrome-extension://abc/${path}`,
      },
      tabs: {
        // 実物のqueryのurl条件はコミット済みのURLにしか当たらないため、
        // urlを指定した問い合わせでは読み込み中のタブを返さない
        query: (queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> =>
          Promise.resolve(
            openedTabs.filter(
              (tab) => queryInfo.url == null || tab.url === queryInfo.url,
            ),
          ),
        create: create,
        update: update,
        move: move,
      },
      windows: {
        update: updateWindow,
      },
    };
  });

  /**
   * 開かれているタブを1件作る
   * @param {number} id タブのid
   * @param {number} windowId タブが属するウィンドウのid
   * @param {string} url タブのURL
   * @return {chrome.tabs.Tab} 作ったタブ
   */
  const tab = (id: number, windowId: number, url: string): chrome.tabs.Tab =>
    ({ id: id, windowId: windowId, url: url }) as chrome.tabs.Tab;

  test('tabsページが開かれていなければ新しいタブで開く', async (): Promise<void> => {
    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(create).toHaveBeenCalledWith({
      active: true,
      url: tabsPageUrl,
      windowId: CLICKED_WINDOW_ID,
    });
    expect(update).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
  });

  // 一覧を複数枚開くと古い一覧からの書き戻しで変更が失われるため、
  // 開いているtabsページがあれば増やさずそこへ切り替える
  test('同じウィンドウにtabsページがあれば新しく開かずそのタブへ切り替える', async (): Promise<void> => {
    openedTabs = [tab(10, CLICKED_WINDOW_ID, tabsPageUrl)];

    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(10, { active: true });
    // 同じウィンドウなので引き取る必要も、フォーカスを移す必要もない
    expect(move).not.toHaveBeenCalled();
    expect(updateWindow).not.toHaveBeenCalled();
  });

  // 読み込みが始まったばかりのタブはurlが空でpendingUrlにだけ入る。
  // queryのurl条件では見つからないため、取りこぼすとアイコンの連打で
  // tabsページが2枚開く
  test('読み込み中のtabsページも既存として扱い、2枚目を開かない', async (): Promise<void> => {
    openedTabs = [
      {
        id: 10,
        windowId: CLICKED_WINDOW_ID,
        url: '',
        pendingUrl: tabsPageUrl,
      } as chrome.tabs.Tab,
    ];

    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(10, { active: true });
  });

  // フォーカスを別ウィンドウへ移すだけで済ませると、アイコンからの保存では
  // 元のウィンドウが最後のタブまで閉じられてウィンドウごと消える
  test('別のウィンドウにあるtabsページは引き取り先のウィンドウへ移す', async (): Promise<void> => {
    openedTabs = [tab(20, 2, tabsPageUrl)];

    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(create).not.toHaveBeenCalled();
    expect(move).toHaveBeenCalledWith(20, {
      windowId: CLICKED_WINDOW_ID,
      index: -1,
    });
    expect(update).toHaveBeenCalledWith(20, { active: true });
    // 引き取った先は既に手元のウィンドウなのでフォーカスは動かさない
    expect(updateWindow).not.toHaveBeenCalled();
  });

  // 引き取り先を渡さない呼び出し元は、どのウィンドウに開くかを指定しない
  test('引き取り先を渡さなければウィンドウを指定せず新しいタブで開く', async (): Promise<void> => {
    await chromeService.tab.createTabsPageTab();

    expect(create).toHaveBeenCalledWith({ active: true, url: tabsPageUrl });
  });

  // 何も閉じない呼び出し元（コンテキストメニュー）は引き取り先を渡さない。
  // 引き取ると、ユーザーがtabsページ専用に開いているウィンドウを空にする
  test('引き取り先を渡さなければ移動せずそのウィンドウを前に出す', async (): Promise<void> => {
    openedTabs = [tab(20, 2, tabsPageUrl)];

    await chromeService.tab.createTabsPageTab();

    expect(create).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(20, { active: true });
    expect(updateWindow).toHaveBeenCalledWith(2, { focused: true });
  });

  // ユーザーが自力で複数枚開いている状況は起こりうる。
  // 勝手に閉じたりせず、引き取り先にあるものへ切り替える
  test('複数枚開かれているときは引き取り先のタブを選び、他は閉じない', async (): Promise<void> => {
    openedTabs = [
      tab(20, 2, tabsPageUrl),
      tab(10, CLICKED_WINDOW_ID, tabsPageUrl),
    ];

    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(create).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(10, { active: true });
  });

  test('複数枚が別ウィンドウにしかなければ1枚だけを引き取る', async (): Promise<void> => {
    openedTabs = [tab(20, 2, tabsPageUrl), tab(30, 3, tabsPageUrl)];

    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(create).not.toHaveBeenCalled();
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith(20, {
      windowId: CLICKED_WINDOW_ID,
      index: -1,
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(20, { active: true });
  });

  // ポップアップや別プロファイルのウィンドウへは移動できない。
  // 移動できないからといって2枚目を開くと、一覧が複数枚になる
  test('引き取れないウィンドウでも2枚目を開かず、そのタブを前に出す', async (): Promise<void> => {
    openedTabs = [tab(20, 2, tabsPageUrl)];
    move.mockRejectedValueOnce(new Error('Tabs cannot be edited right now'));
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

      expect(create).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(20, { active: true });
      expect(updateWindow).toHaveBeenCalledWith(2, { focused: true });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  // 探した後に閉じられたタブへ書くと失敗する。一覧を開けないまま終わると
  // 呼び出し元は保存だけ済んで何も起きていないように見える
  test('切り替え先のタブが消えていたら新しいタブで開く', async (): Promise<void> => {
    openedTabs = [tab(10, CLICKED_WINDOW_ID, tabsPageUrl)];
    update.mockRejectedValueOnce(new Error('No tab with id: 10'));
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

      expect(create).toHaveBeenCalledWith({
        active: true,
        url: tabsPageUrl,
        windowId: CLICKED_WINDOW_ID,
      });
      expect(updateWindow).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test('tabsページ以外のタブは切り替え先にしない', async (): Promise<void> => {
    openedTabs = [tab(10, CLICKED_WINDOW_ID, 'https://example.com/')];

    await chromeService.tab.createTabsPageTab(CLICKED_WINDOW_ID);

    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      active: true,
      url: tabsPageUrl,
      windowId: CLICKED_WINDOW_ID,
    });
  });
});

describe('chromeService.tab.isTabsPage', (): void => {
  beforeEach((): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {
        getURL: (path: string): string => `chrome-extension://abc/${path}`,
      },
    };
  });

  test.each([
    ['urlがtabsページ', { url: 'chrome-extension://abc/tabs.html' }, true],
    // 読み込みが始まったばかりのタブはurlが空でpendingUrlにだけ入る
    [
      '読み込み中のtabsページ',
      { url: '', pendingUrl: 'chrome-extension://abc/tabs.html' },
      true,
    ],
    ['別のページ', { url: 'https://example.com/' }, false],
    ['urlを持たないタブ', {}, false],
  ])('%sの判定は%s', (_name: string, tab: object, expected: boolean): void => {
    expect(chromeService.tab.isTabsPage(tab as chrome.tabs.Tab)).toBe(expected);
  });
});

describe('chromeService.storage.isBlockDataKey', (): void => {
  test.each([
    ['t_len', true],
    ['td_0', true],
    ['td_12', true],
    ['td_', false],
    ['td_x', false],
    ['td_1x', false],
    ['error', false],
    ['', false],
  ])('%sの判定は%s', (key: string, expected: boolean): void => {
    expect(chromeService.storage.isBlockDataKey(key)).toBe(expected);
  });
});

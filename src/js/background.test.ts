/**
 * @jest-environment jsdom
 *
 * service workerとして動くコードだが、chrome拡張のAPI以外はブラウザと同じ
 * 実行環境を前提にしているため、他のテストと同様にjsdomで検証する
 */

describe('background action.onClicked', (): void => {
  const tabsPageUrl = 'chrome-extension://abc/tabs.html';
  // アイコンをクリックしたウィンドウ
  const CURRENT_WINDOW_ID = 1;
  let openedTabs: chrome.tabs.Tab[];
  let clickAction: () => void;
  const create = jest.fn();
  const update = jest.fn();
  const move = jest.fn();
  const remove = jest.fn();
  const setBlock = jest.fn();
  const setTabLength = jest.fn();

  /**
   * 開かれているタブを1件作る
   * @param {number} id タブのid
   * @param {string} url タブのURL
   * @return {chrome.tabs.Tab} 作ったタブ
   */
  const tab = (
    id: number,
    url: string,
    windowId: number = CURRENT_WINDOW_ID,
  ): chrome.tabs.Tab =>
    ({ id: id, windowId: windowId, url: url, title: url }) as chrome.tabs.Tab;

  /**
   * chromeのAPIを差し替えたうえでbackgroundを読み込み、
   * アイコンのクリックを再現できる状態にする
   * @return {Promise<void>}
   */
  const loadBackground = async (): Promise<void> => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {
        getURL: (path: string): string => `chrome-extension://abc/${path}`,
        getManifest: () => ({ name: 'SyncTabClipper', version: '9.9.9' }),
        onInstalled: { addListener: (): void => undefined },
      },
      contextMenus: { onClicked: { addListener: (): void => undefined } },
      action: {
        onClicked: {
          addListener: (listener: () => void): void => {
            clickAction = listener;
          },
        },
      },
      i18n: { getMessage: (key: string): string => key },
      tabs: {
        query: (queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> =>
          Promise.resolve(
            openedTabs.filter(
              (t) =>
                (queryInfo.url == null || t.url === queryInfo.url) &&
                (queryInfo.currentWindow !== true ||
                  t.windowId === CURRENT_WINDOW_ID),
            ),
          ),
        create: create,
        update: update,
        move: move,
        remove: remove,
      },
      windows: {
        getCurrent: (): Promise<chrome.windows.Window> =>
          Promise.resolve({ id: CURRENT_WINDOW_ID } as chrome.windows.Window),
        update: jest.fn(),
      },
    };
    const { chromeService } = await import('./chromeService');
    jest.spyOn(chromeService.storage, 'getTabLength').mockResolvedValue(3);
    jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockImplementation((block) => {
        setBlock(block);
        return Promise.resolve();
      });
    jest
      .spyOn(chromeService.storage, 'setTabLength')
      .mockImplementation((value) => {
        setTabLength(value);
        return Promise.resolve();
      });
    await import('./background');
  };

  beforeEach((): void => {
    openedTabs = [];
    create.mockClear();
    update.mockClear();
    move.mockClear();
    remove.mockClear();
    setBlock.mockClear();
    setTabLength.mockClear();
  });

  /**
   * アイコンのクリックを再現し、非同期の処理が終わるまで待つ
   * @return {Promise<void>}
   */
  const click = async (): Promise<void> => {
    clickAction();
    // onClickedのリスナーはPromiseを返さないため、マイクロタスクを消化して待つ
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
  };

  test('現在のウィンドウの全タブを保存して閉じ、tabsページを開く', async (): Promise<void> => {
    openedTabs = [
      tab(1, 'https://example.com/a'),
      tab(2, 'https://example.com/b'),
    ];
    await loadBackground();

    await click();

    expect(setBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        indexNum: 3,
        tabs: [
          expect.objectContaining({ url: 'https://example.com/a' }),
          expect.objectContaining({ url: 'https://example.com/b' }),
        ],
      }),
    );
    expect(setTabLength).toHaveBeenCalledWith(4);
    expect(create).toHaveBeenCalledWith({ active: true, url: tabsPageUrl });
    expect(remove.mock.calls.map((call) => call[0])).toEqual([1, 2]);
  });

  // 既存のtabsページへ切り替えるようになったため、tabsページを閉じる対象に
  // 残すと切り替えた直後のタブを自分で閉じてしまう
  test('tabsページは保存も終了もせず、そのタブへ切り替える', async (): Promise<void> => {
    openedTabs = [tab(1, 'https://example.com/a'), tab(9, tabsPageUrl)];
    await loadBackground();

    await click();

    expect(setBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [expect.objectContaining({ url: 'https://example.com/a' })],
      }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(9, { active: true });
    // tabsページ自身は閉じない
    expect(remove.mock.calls.map((call) => call[0])).toEqual([1]);
  });

  // 別ウィンドウのtabsページへフォーカスを移すだけで済ませると、
  // 現在のウィンドウは最後のタブまで閉じられてウィンドウごと消えてしまう
  test('別ウィンドウのtabsページは現在のウィンドウへ引き取ってから閉じる', async (): Promise<void> => {
    openedTabs = [
      tab(1, 'https://example.com/a'),
      tab(2, 'https://example.com/b'),
      tab(9, tabsPageUrl, 2),
    ];
    await loadBackground();

    await click();

    // 現在のウィンドウのタブだけを保存する
    expect(setBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [
          expect.objectContaining({ url: 'https://example.com/a' }),
          expect.objectContaining({ url: 'https://example.com/b' }),
        ],
      }),
    );
    // 2枚目を開かず、既存のtabsページを引き取る
    expect(create).not.toHaveBeenCalled();
    expect(move).toHaveBeenCalledWith(9, {
      windowId: CURRENT_WINDOW_ID,
      index: -1,
    });
    expect(update).toHaveBeenCalledWith(9, { active: true });
    // 引き取ったtabsページは閉じないので、ウィンドウが空にならない
    expect(remove.mock.calls.map((call) => call[0])).toEqual([1, 2]);
  });

  // 開いた直後のタブはurlが空でpendingUrlにだけ入る。判定を漏らすと、
  // 開きかけのtabsページを保存対象に含めて空のリンクを持つブロックを作り、
  // 既存として見つけられず2枚目も開いてしまう
  test('読み込み中のtabsページも保存も終了もしない', async (): Promise<void> => {
    const loading = {
      id: 9,
      windowId: CURRENT_WINDOW_ID,
      url: '',
      pendingUrl: tabsPageUrl,
    } as chrome.tabs.Tab;
    openedTabs = [tab(1, 'https://example.com/a'), loading];
    await loadBackground();

    await click();

    expect(setBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [expect.objectContaining({ url: 'https://example.com/a' })],
      }),
    );
    expect(remove.mock.calls.map((call) => call[0])).toEqual([1]);
  });

  // 保存するものがないのにindexを進めると、欠番だけが増えていく
  test('tabsページしか開いていないときは何も保存せず切り替えるだけ', async (): Promise<void> => {
    openedTabs = [tab(9, tabsPageUrl)];
    await loadBackground();

    await click();

    expect(setBlock).not.toHaveBeenCalled();
    expect(setTabLength).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(9, { active: true });
    expect(remove).not.toHaveBeenCalled();
  });
});

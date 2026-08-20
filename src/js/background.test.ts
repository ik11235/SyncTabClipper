/**
 * @jest-environment jsdom
 *
 * service workerとして動くコードだが、chrome拡張のAPI以外はブラウザと同じ
 * 実行環境を前提にしているため、他のテストと同様にjsdomで検証する
 */

describe('background action.onClicked', (): void => {
  const tabsPageUrl = 'chrome-extension://abc/tabs.html';
  let openedTabs: chrome.tabs.Tab[];
  let clickAction: () => void;
  const create = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const setBlock = jest.fn();
  const setTabLength = jest.fn();

  /**
   * 開かれているタブを1件作る
   * @param {number} id タブのid
   * @param {string} url タブのURL
   * @return {chrome.tabs.Tab} 作ったタブ
   */
  const tab = (id: number, url: string): chrome.tabs.Tab =>
    ({ id: id, windowId: 1, url: url, title: url }) as chrome.tabs.Tab;

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
            queryInfo.url == null
              ? openedTabs
              : openedTabs.filter((t) => t.url === queryInfo.url),
          ),
        create: create,
        update: update,
        remove: remove,
      },
      windows: { update: jest.fn() },
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

/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './app';
import { chromeService } from '../chromeService';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('App', (): void => {
  let localData: { [key: string]: string };
  let onChangedListeners: Array<
    (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => void
  >;
  let container: HTMLDivElement;
  let root: Root;
  let getAllBlockSpy: jest.SpyInstance;

  const mount = async (): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
  };

  beforeEach((): void => {
    localData = {};
    onChangedListeners = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    getAllBlockSpy = jest.spyOn(chromeService.storage, 'getAllBlock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {
        getManifest: () => ({ name: 'SyncTabClipper', version: '9.9.9' }),
      },
      i18n: {
        getMessage: (key: string): string => key,
      },
      storage: {
        local: {
          set: (obj: { [key: string]: string }, cb: () => void): void => {
            Object.assign(localData, obj);
            cb();
            // 実際のChromeと同様に、変更をonChangedリスナーへ通知する
            for (const listener of onChangedListeners) {
              const changes: { [key: string]: chrome.storage.StorageChange } =
                {};
              for (const key of Object.keys(obj)) {
                changes[key] = { newValue: obj[key] };
              }
              listener(changes, 'local');
            }
          },
          get: (
            keys: string[],
            cb: (items: { [key: string]: string }) => void,
          ): void => {
            const res: { [key: string]: string } = {};
            for (const key of keys) {
              const value = localData[key];
              if (value != null) {
                res[key] = value;
              }
            }
            cb(res);
          },
          remove: (key: string, cb: () => void): void => {
            delete localData[key];
            cb();
          },
        },
        sync: {
          QUOTA_BYTES: 102400,
          getBytesInUse: (): Promise<number> => Promise.resolve(0),
        },
        onChanged: {
          addListener: (
            listener: (
              changes: { [key: string]: chrome.storage.StorageChange },
              areaName: string,
            ) => void,
          ): void => {
            onChangedListeners.push(listener);
          },
          removeListener: jest.fn(),
        },
      },
      action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
      },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    getAllBlockSpy.mockRestore();
  });

  test('ブロック読み込み成功時はタブの一覧を描画する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);

    await mount();

    expect(container.textContent).toContain('SyncTabClipper');
    expect(container.textContent).toContain('title-test');
    expect(container.textContent).toContain('content_msg_menu');
  });

  test('ブロックが空のときは未保存メッセージを表示する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([]);

    await mount();

    expect(container.textContent).toContain('content_msg_not_tab');
  });

  test('ブロック削除時はAppのstateが更新され一覧から消える', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);

    try {
      await mount();
      expect(container.textContent).toContain('title-test');

      const deleteLink = container.querySelector(
        '.all_tab_delete',
      ) as HTMLElement;
      await act(async () => {
        deleteLink.click();
      });

      // storageへ空タブのブロックとして永続化され、一覧からも消える
      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ indexNum: 0, tabs: [] }),
      );
      expect(container.textContent).not.toContain('title-test');
      expect(container.textContent).toContain('content_msg_not_tab');
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  test('あるブロックの更新時に他のブロックは再レンダリングされない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [
          { url: 'https://example.com/a1', title: 'title-a1' },
          { url: 'https://example.com/a2', title: 'title-a2' },
        ],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-03T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/b1', title: 'title-b1' }],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    // Blockはレンダリングのたびにcontent_msg_tab_lengthを必ず1回取得するため、
    // その呼び出し回数を再レンダリング回数の代理指標として使う
    const getMessageSpy = jest.fn((key: string): string => key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome.i18n.getMessage = getMessageSpy;

    try {
      await mount();
      getMessageSpy.mockClear();

      // 先頭ブロック（ブロックA）のタブを1件削除する
      const tabCloseLink = container.querySelector(
        '.tab_close',
      ) as HTMLElement;
      await act(async () => {
        tabCloseLink.click();
      });

      expect(container.textContent).not.toContain('title-a1');
      expect(container.textContent).toContain('title-a2');
      expect(container.textContent).toContain('title-b1');
      // 再レンダリングされたのは更新したブロックAのみ
      // （ブロックBも再レンダリングされると2になる）
      const blockRenderCount = getMessageSpy.mock.calls.filter(
        ([key]) => key === 'content_msg_tab_length',
      ).length;
      expect(blockRenderCount).toBe(1);
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  test('全データ削除時はAppのstateが空になり未保存メッセージを表示する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);
    const allClearSpy = jest
      .spyOn(chromeService.storage, 'allClear')
      .mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = jest
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);

    try {
      await mount();
      expect(container.textContent).toContain('title-test');

      const allClearLink = container.querySelector('#all_clear') as HTMLElement;
      await act(async () => {
        allClearLink.click();
      });

      // storageが全削除され、一覧も空表示に切り替わる
      expect(allClearSpy).toHaveBeenCalled();
      expect(container.textContent).not.toContain('title-test');
      expect(container.textContent).toContain('content_msg_not_tab');
    } finally {
      allClearSpy.mockRestore();
      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    }
  });

  test('ブロック読み込み失敗時もエラー表示は機能する', async (): Promise<void> => {
    getAllBlockSpy.mockRejectedValue(new Error('load failed'));

    await mount();

    expect(container.textContent).toContain('load failed');
    // ヘッダーとサイドバーは読み込み失敗と無関係に描画される
    expect(container.textContent).toContain('SyncTabClipper');
    expect(container.textContent).toContain('content_msg_menu');
  });

  test('Mainのレンダリング時例外でもページ全体は生き残りエラーを表示する', async (): Promise<void> => {
    // createdAtが不正なDateだとblock.tsxのtoISOString()がRangeErrorを投げる
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('invalid'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      // ヘッダー・サイドバーはアンマウントされず、エラーが表示される
      expect(container.textContent).toContain('SyncTabClipper');
      expect(container.textContent).toContain('content_msg_menu');
      expect(container.textContent).toContain('Invalid time value');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

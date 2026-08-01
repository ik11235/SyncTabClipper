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

  test('ブロック読み込み失敗時もエラー表示は機能する', async (): Promise<void> => {
    getAllBlockSpy.mockRejectedValue(new Error('load failed'));

    await mount();

    expect(container.textContent).toContain('load failed');
    // ヘッダーとサイドバーは読み込み失敗と無関係に描画される
    expect(container.textContent).toContain('SyncTabClipper');
    expect(container.textContent).toContain('content_msg_menu');
  });
});

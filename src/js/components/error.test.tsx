/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ErrorDisplay } from './error';
import { chromeService } from '../chromeService';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('ErrorDisplay', (): void => {
  let localData: { [key: string]: string };
  let onChangedListeners: Array<
    (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => void
  >;
  let container: HTMLDivElement;
  let root: Root;
  const setBadgeText = jest.fn();

  const setVisibility = (state: 'visible' | 'hidden'): void => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
  };

  const errorKey = chromeService.errorLog.errorKey;

  const mount = async (): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(<ErrorDisplay />);
    });
  };

  const notifyRemoved = async (): Promise<void> => {
    await act(async () => {
      for (const listener of onChangedListeners) {
        listener({ [errorKey]: { oldValue: 'boom' } }, 'local');
      }
    });
  };

  beforeEach((): void => {
    localData = {};
    onChangedListeners = [];
    setBadgeText.mockClear();
    setVisibility('visible');
    container = document.createElement('div');
    document.body.appendChild(container);
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
        setBadgeText: setBadgeText,
        setBadgeBackgroundColor: jest.fn(),
      },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
  });

  test('可視ページでは表示した時点で保存とバッジをクリアし表示は残す', async (): Promise<void> => {
    localData[errorKey] = 'boom';

    await mount();

    expect(container.textContent).toContain('boom');
    expect(localData[errorKey]).toBeUndefined();
    expect(setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  test('非可視ページでは表示するが保存とバッジは消費しない', async (): Promise<void> => {
    setVisibility('hidden');
    localData[errorKey] = 'boom';

    await mount();

    expect(container.textContent).toContain('boom');
    expect(localData[errorKey]).toBe('boom');
    expect(setBadgeText).not.toHaveBeenCalled();
  });

  test('非可視ページが可視になった時点で保存とバッジをクリアする', async (): Promise<void> => {
    setVisibility('hidden');
    localData[errorKey] = 'boom';
    await mount();
    expect(localData[errorKey]).toBe('boom');

    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(container.textContent).toContain('boom');
    expect(localData[errorKey]).toBeUndefined();
    expect(setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  test('非可視ページは他ページでの確認済みクリアに追随して非表示になる', async (): Promise<void> => {
    setVisibility('hidden');
    localData[errorKey] = 'boom';
    await mount();
    expect(container.textContent).toContain('boom');

    delete localData[errorKey];
    await notifyRemoved();

    expect(container.textContent).toBe('');
  });

  test('可視ページは確認済みクリア後もアラートを表示し続ける', async (): Promise<void> => {
    localData[errorKey] = 'boom';
    await mount();

    // 自身の消費によるstorage変更イベントが届いても表示は取り下げない
    await notifyRemoved();

    expect(container.textContent).toContain('boom');
  });

  test('閉じると非表示になり保存とバッジがクリアされる', async (): Promise<void> => {
    setVisibility('hidden');
    localData[errorKey] = 'boom';
    await mount();

    const closeButton =
      container.querySelector<HTMLAnchorElement>('a.uk-alert-close')!;
    await act(async () => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toBe('');
    expect(localData[errorKey]).toBeUndefined();
    expect(setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  test('未保存時は何も表示しない', async (): Promise<void> => {
    await mount();

    expect(container.textContent).toBe('');
  });

  test('表示中にstorage.onChangedで新しいエラーが届くと表示する', async (): Promise<void> => {
    await mount();

    localData[errorKey] = 'late error';
    await act(async () => {
      for (const listener of onChangedListeners) {
        listener({ [errorKey]: { newValue: 'late error' } }, 'local');
      }
    });

    expect(container.textContent).toContain('late error');
  });
});

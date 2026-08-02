/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import StorageUsage from './storageUsage';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('StorageUsage', (): void => {
  let bytesInUse: number;
  let onChangedListeners: Array<
    (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => void
  >;
  let container: HTMLDivElement;
  let root: Root;
  const removeListener = jest.fn();

  const mount = async (): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StorageUsage />);
    });
  };

  const notifyChanged = async (areaName: string): Promise<void> => {
    await act(async () => {
      for (const listener of onChangedListeners) {
        listener({ td_0: { newValue: 'dummy' } }, areaName);
      }
    });
  };

  beforeEach((): void => {
    bytesInUse = 1024;
    onChangedListeners = [];
    removeListener.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      i18n: {
        // 引数の確認ができるよう、キーと置換引数を連結して返す
        getMessage: (key: string, substitutions?: string[]): string =>
          substitutions == null ? key : `${key}:${substitutions.join('/')}`,
      },
      storage: {
        sync: {
          QUOTA_BYTES: 102400,
          getBytesInUse: (): Promise<number> => Promise.resolve(bytesInUse),
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
          removeListener: removeListener,
        },
      },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
  });

  test('マウント時に使用量と上限とプログレスバーを表示する', async (): Promise<void> => {
    await mount();

    expect(container.textContent).toContain('content_msg_storage_usage');
    expect(container.textContent).toContain(
      `content_msg_storage_usage_detail:${(1024).toLocaleString()}/${(102400).toLocaleString()}/1.00`,
    );
    const progress = container.querySelector<HTMLProgressElement>(
      'progress.uk-progress',
    )!;
    expect(progress.value).toBe(1024);
    expect(progress.max).toBe(102400);
  });

  test('storage.syncの変更で使用量を再取得して表示を更新する', async (): Promise<void> => {
    await mount();

    bytesInUse = 51200;
    await notifyChanged('sync');

    expect(container.textContent).toContain(
      `content_msg_storage_usage_detail:${(51200).toLocaleString()}/${(102400).toLocaleString()}/50.00`,
    );
    const progress = container.querySelector<HTMLProgressElement>(
      'progress.uk-progress',
    )!;
    expect(progress.value).toBe(51200);
  });

  test('storage.local の変更では再取得しない', async (): Promise<void> => {
    await mount();

    bytesInUse = 51200;
    await notifyChanged('local');

    expect(container.textContent).toContain(
      `content_msg_storage_usage_detail:${(1024).toLocaleString()}/${(102400).toLocaleString()}/1.00`,
    );
  });

  test('アンマウント時にonChangedのリスナーを解除する', async (): Promise<void> => {
    await mount();

    act(() => root.unmount());

    expect(removeListener).toHaveBeenCalledWith(onChangedListeners[0]);
  });
});

/**
 * @jest-environment jsdom
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { ErrorDisplay } from './error';
import { chromeService } from '../chromeService';

describe('ErrorDisplay', (): void => {
  let localData: { [key: string]: string };
  let onChangedListeners: Array<
    (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => void
  >;
  let container: HTMLDivElement;

  beforeEach((): void => {
    localData = {};
    onChangedListeners = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {},
      storage: {
        local: {
          set: (obj: { [key: string]: string }, cb: () => void): void => {
            Object.assign(localData, obj);
            cb();
          },
          get: (
            keys: string[],
            cb: (items: { [key: string]: string }) => void
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
              areaName: string
            ) => void
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
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  test('マウント時に保存済みエラーを表示する（保存は消費しない）', async (): Promise<void> => {
    localData[chromeService.errorLog.errorKey] = 'boom';

    await act(async () => {
      ReactDOM.render(<ErrorDisplay />, container);
    });

    expect(container.textContent).toContain('boom');
    // 他のtabsページでも表示できるよう、表示しただけでは保存を消費しない
    expect(localData[chromeService.errorLog.errorKey]).toBe('boom');
  });

  test('閉じると非表示になり保存とバッジがクリアされる', async (): Promise<void> => {
    localData[chromeService.errorLog.errorKey] = 'boom';

    await act(async () => {
      ReactDOM.render(<ErrorDisplay />, container);
    });

    const closeButton =
      container.querySelector<HTMLAnchorElement>('a.uk-alert-close')!;
    await act(async () => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toBe('');
    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((global as any).chrome.action.setBadgeText).toHaveBeenCalledWith({
      text: '',
    });
  });

  test('他ページでのクリアに追随して非表示になる', async (): Promise<void> => {
    localData[chromeService.errorLog.errorKey] = 'boom';

    await act(async () => {
      ReactDOM.render(<ErrorDisplay />, container);
    });
    expect(container.textContent).toContain('boom');

    delete localData[chromeService.errorLog.errorKey];
    await act(async () => {
      for (const listener of onChangedListeners) {
        listener(
          {
            [chromeService.errorLog.errorKey]: {
              oldValue: 'boom',
            },
          },
          'local'
        );
      }
    });

    expect(container.textContent).toBe('');
  });

  test('未保存時は何も表示しない', async (): Promise<void> => {
    await act(async () => {
      ReactDOM.render(<ErrorDisplay />, container);
    });

    expect(container.textContent).toBe('');
  });

  test('表示中にstorage.onChangedで新しいエラーが届くと表示する', async (): Promise<void> => {
    await act(async () => {
      ReactDOM.render(<ErrorDisplay />, container);
    });

    localData[chromeService.errorLog.errorKey] = 'late error';
    await act(async () => {
      for (const listener of onChangedListeners) {
        listener(
          {
            [chromeService.errorLog.errorKey]: {
              newValue: 'late error',
            },
          },
          'local'
        );
      }
    });

    expect(container.textContent).toContain('late error');
  });
});

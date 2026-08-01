import { chromeService } from './chromeService';

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

  test('popで取り出すと保存とバッジがクリアされる', async (): Promise<void> => {
    await chromeService.errorLog.set('boom');

    await expect(chromeService.errorLog.pop()).resolves.toBe('boom');
    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    expect(setBadgeText).toHaveBeenLastCalledWith({ text: '' });
  });

  test('未保存時のpopはnullを返す', async (): Promise<void> => {
    await expect(chromeService.errorLog.pop()).resolves.toBeNull();
  });

  test('lastError発生時はErrorインスタンスでrejectする', async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome.storage.local.set = (
      _obj: { [key: string]: string },
      cb: () => void
    ): void => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).chrome.runtime.lastError = { message: 'quota exceeded' };
      cb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).chrome.runtime.lastError;
    };

    const result = chromeService.errorLog.set('boom');
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toThrow('quota exceeded');
  });

  test('clearで保存とバッジが消える', async (): Promise<void> => {
    await chromeService.errorLog.set('boom');
    await chromeService.errorLog.clear();

    expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    expect(setBadgeText).toHaveBeenLastCalledWith({ text: '' });
  });
});

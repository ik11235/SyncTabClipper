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

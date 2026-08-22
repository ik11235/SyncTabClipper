/**
 * @jest-environment jsdom
 *
 * インポートの通知はページの読み込み直しと競合する。読み込み直しの前に
 * 同期的に伝わることを、実際のDOM操作から確かめる
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import SideBar from './sideBar';
import { blockService } from '../blockService';
import { chromeService } from '../chromeService';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('SideBar インポート', (): void => {
  let container: HTMLDivElement;
  let root: Root;
  let importSpy: jest.SpyInstance;
  let errorLogSetSpy: jest.SpyInstance;
  const reload = jest.fn();
  const alertMock = jest.fn();
  const deleteAllBlocks = jest.fn();

  const mount = async (): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(<SideBar deleteAllBlocks={deleteAllBlocks} />);
    });
  };

  const importClick = async (json: string): Promise<void> => {
    const textarea =
      container.querySelector<HTMLTextAreaElement>('#import_body')!;
    textarea.value = json;
    await act(async () => {
      container.querySelector<HTMLButtonElement>('#import_link')!.click();
    });
  };

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    reload.mockClear();
    alertMock.mockClear();
    deleteAllBlocks.mockClear();
    window.alert = alertMock;
    importSpy = jest.spyOn(blockService, 'importAllDataJson');
    errorLogSetSpy = jest
      .spyOn(chromeService.errorLog, 'set')
      .mockResolvedValue(undefined);
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
          getBytesInUse: (): Promise<number> => Promise.resolve(0),
        },
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      },
      tabs: { reload: reload },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    importSpy.mockRestore();
    errorLogSetSpy.mockRestore();
  });

  test('全件書き込めたら通知せず読み込み直す', async (): Promise<void> => {
    importSpy.mockResolvedValue({ importedCount: 2, failedCount: 0 });
    await mount();

    await importClick('{"v":2,"blocks":[]}');

    expect(alertMock).not.toHaveBeenCalled();
    expect(errorLogSetSpy).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledWith({ bypassCache: true });
  });

  // errorLogに流すと、可視ページのErrorDisplayがその場で確認済みとして
  // 消してしまい、読み込み直した先には残らない
  test('一部書き込めなかったら件数をalertで伝える', async (): Promise<void> => {
    importSpy.mockResolvedValue({ importedCount: 2, failedCount: 1 });
    await mount();

    await importClick('{"v":2,"blocks":[]}');

    expect(alertMock).toHaveBeenCalledWith(
      'content_msg_import_partial_failure:3/1',
    );
    expect(errorLogSetSpy).not.toHaveBeenCalled();
  });

  // 1件も書き込めていないのに「書き込めたブロックは一覧に表示されています」と
  // 出すと、どこかに保存されたものと誤解させる。
  // 読み込み直しても貼り付けた内容とエクスポート結果を捨てるだけなので
  // 読み込み直さない
  //
  // 読み込み直さないならerrorLogが読み込み直しで消えることもないので、
  // インポート自体が失敗したときと同じく赤バッジが残るerrorLogで伝える
  test('1件も書き込めなかったらerrorLogで伝え読み込み直さない', async (): Promise<void> => {
    importSpy.mockResolvedValue({ importedCount: 0, failedCount: 3 });
    await mount();

    await importClick('{"v":2,"blocks":[]}');

    expect(errorLogSetSpy).toHaveBeenCalledWith(
      'content_msg_import_all_failed:3',
    );
    expect(alertMock).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  // alertは閉じるまで同期的に止まるので、この順序なら通知は必ず目に入る
  test('通知してから読み込み直す', async (): Promise<void> => {
    importSpy.mockResolvedValue({ importedCount: 1, failedCount: 1 });
    let alertedBeforeReload = false;
    alertMock.mockImplementation(() => {
      alertedBeforeReload = reload.mock.calls.length === 0;
    });
    await mount();

    await importClick('{"v":2,"blocks":[]}');

    expect(alertedBeforeReload).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // 書き込みは済んでいるのに「インポートに失敗しました」と出すと、
  // ユーザーが再インポートしてブロックを重複させる
  test('通知や読み込み直しで例外が出てもインポート失敗として通知しない', async (): Promise<void> => {
    importSpy.mockResolvedValue({ importedCount: 2, failedCount: 1 });
    alertMock.mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await mount();

    try {
      await importClick('{"v":2,"blocks":[]}');

      expect(errorLogSetSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test('インポート自体が失敗したらerrorLogで通知し読み込み直さない', async (): Promise<void> => {
    importSpy.mockRejectedValue(new Error('Unsupported data version: v=99'));
    await mount();

    await importClick('{"v":99}');

    expect(errorLogSetSpy).toHaveBeenCalledWith(
      'content_msg_failed_import Unsupported data version: v=99',
    );
    expect(alertMock).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

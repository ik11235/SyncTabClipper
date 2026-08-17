/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { EditTabModal } from './editTabModal';
import { model } from '../types/interface';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('EditTabModal', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (
    tab: model.Tab,
    onSave: (newTab: model.Tab) => Promise<void>,
    onCancel: VoidFunction = jest.fn(),
  ): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <EditTabModal tab={tab} onSave={onSave} onCancel={onCancel} />,
      );
    });
  };

  const titleInput = (): HTMLInputElement =>
    container.querySelector<HTMLInputElement>('.edit-tab-title')!;
  const urlInput = (): HTMLInputElement =>
    container.querySelector<HTMLInputElement>('.edit-tab-url')!;
  const saveButton = (): HTMLButtonElement =>
    container.querySelector<HTMLButtonElement>('.edit-tab-save')!;

  // Reactが管理するinputへの入力を再現する（valueの直接代入だけでは
  // ReactのonChangeが発火しない）
  const typeInto = async (
    input: HTMLInputElement,
    value: string,
  ): Promise<void> => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const submit = async (): Promise<void> => {
    await act(async () => {
      saveButton().click();
    });
  };

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      i18n: {
        getMessage: (key: string): string => key,
      },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
  });

  test('現在のタイトルとURLを初期値として表示する', async (): Promise<void> => {
    await mount(
      { url: 'https://example.com/', title: 'example title' },
      jest.fn().mockResolvedValue(undefined),
    );

    expect(titleInput().value).toBe('example title');
    expect(urlInput().value).toBe('https://example.com/');
  });

  test('編集した値をonSaveへ渡す', async (): Promise<void> => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount({ url: 'https://example.com/', title: 'old title' }, onSave);

    await typeInto(titleInput(), 'Gmail フィルター');
    await typeInto(urlInput(), 'https://example.com/new');
    await submit();

    expect(onSave).toHaveBeenCalledWith({
      title: 'Gmail フィルター',
      url: 'https://example.com/new',
    });
  });

  // 前後の空白がそのまま保存されると、一覧の表示やURLの解決が意図とずれる
  test('タイトルとURLの前後の空白を落として保存する', async (): Promise<void> => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount({ url: 'https://example.com/', title: 'old title' }, onSave);

    await typeInto(titleInput(), '  new title  ');
    await typeInto(urlInput(), '  https://example.com/new  ');
    await submit();

    expect(onSave).toHaveBeenCalledWith({
      title: 'new title',
      url: 'https://example.com/new',
    });
  });

  // titleが空だとリンクの文字が消えてクリックできなくなる
  test('タイトルが空のときは保存せずエラーを表示する', async (): Promise<void> => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount({ url: 'https://example.com/', title: 'old title' }, onSave);

    await typeInto(titleInput(), '   ');
    await submit();

    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('.edit-tab-error')!.textContent).toBe(
      'content_msg_edit_tab_title_required',
    );
  });

  // 開けないURLを保存すると壊れたタブが増える
  test('URLとして解釈できない文字列は保存せずエラーを表示する', async (): Promise<void> => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount({ url: 'https://example.com/', title: 'old title' }, onSave);

    await typeInto(urlInput(), 'example.com');
    await submit();

    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('.edit-tab-error')!.textContent).toBe(
      'content_msg_edit_tab_url_invalid',
    );
  });

  test('URLが空のときは保存せずエラーを表示する', async (): Promise<void> => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount({ url: '', title: 'old title' }, onSave);

    await submit();

    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('.edit-tab-error')!.textContent).toBe(
      'content_msg_edit_tab_url_invalid',
    );
  });

  test('キャンセルボタンでonCancelを呼ぶ', async (): Promise<void> => {
    const onCancel = jest.fn();
    await mount(
      { url: 'https://example.com/', title: 'old title' },
      jest.fn().mockResolvedValue(undefined),
      onCancel,
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-cancel')!.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('EscキーでonCancelを呼ぶ', async (): Promise<void> => {
    const onCancel = jest.fn();
    await mount(
      { url: 'https://example.com/', title: 'old title' },
      jest.fn().mockResolvedValue(undefined),
      onCancel,
    );

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // 保存データのtitle/urlは型では文字列だが、実際には文字列とは限らない
  // （createBlockの`tab.title!`、インポートJSONの型検証なし）。
  // 型を信じて入力欄に入れると非制御になり、保存時にtrimで例外になる
  test('titleが文字列でないタブでも空欄として編集し保存できる', async (): Promise<void> => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount(
      { url: 'https://example.com/' } as unknown as model.Tab,
      onSave,
    );

    expect(titleInput().value).toBe('');

    await typeInto(titleInput(), 'recovered');
    await submit();

    expect(onSave).toHaveBeenCalledWith({
      title: 'recovered',
      url: 'https://example.com/',
    });
  });

  test('urlが文字列でないタブでも空欄として編集できる', async (): Promise<void> => {
    await mount({ title: 'title only' } as unknown as model.Tab, jest.fn());

    expect(urlInput().value).toBe('');
  });

  // 保存の可否が分からないまま閉じてしまうのを防ぐ
  test('保存中はEscキーで閉じない', async (): Promise<void> => {
    const onCancel = jest.fn();
    // 解決しないPromiseを返し、保存中の状態で留める
    const onSave = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    await mount(
      { url: 'https://example.com/', title: 'old title' },
      onSave,
      onCancel,
    );

    await submit();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBe(true);
  });

  // 保存が終わらないときにモーダルから出られなくなるのを防ぐ
  test('保存中でもキャンセルボタンは押せる', async (): Promise<void> => {
    const onCancel = jest.fn();
    // 解決しないPromiseを返し、保存中の状態で留める
    const onSave = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    await mount(
      { url: 'https://example.com/', title: 'old title' },
      onSave,
      onCancel,
    );

    await submit();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-cancel')!.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // 保存に失敗したときに入力が消えると、書き直しをやり直す羽目になる
  test('保存に失敗したら入力を残したまま再試行できる', async (): Promise<void> => {
    const onSave = jest
      .fn()
      .mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'))
      .mockResolvedValue(undefined);
    await mount({ url: 'https://example.com/', title: 'old title' }, onSave);

    await typeInto(titleInput(), 'new title');
    await submit();

    expect(titleInput().value).toBe('new title');
    expect(saveButton().disabled).toBe(false);
    // errorLog経由のアラートはモーダルのオーバーレイの裏になって読めないため、
    // 失敗はモーダル内にも出す
    expect(container.querySelector('.edit-tab-error')!.textContent).toBe(
      'content_msg_edit_tab_save_failed',
    );

    await submit();

    expect(onSave).toHaveBeenCalledTimes(2);
  });
});

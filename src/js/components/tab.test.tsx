/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Tab } from './tab';
import { model } from '../types/interface';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Tab', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (
    tab: { url: string; title: string },
    group?: model.TabGroup,
  ): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tab
          tab={tab}
          group={group}
          deleteClick={jest.fn()}
          editClick={jest.fn()}
          openLinkClick={jest.fn()}
          locked={false}
        />,
      );
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

  test('タイトルとURLをそのまま表示する', async (): Promise<void> => {
    await mount({
      url: 'https://example.com/',
      title: 'example title',
    });

    const link = container.querySelector<HTMLAnchorElement>('a.tab_link')!;
    expect(link.textContent).toBe('example title');
    expect(link.getAttribute('href')).toBe('https://example.com/');
  });

  // chrome.tabs.Tab.urlはコミット前のタブでは空文字列になりうるため、
  // 空urlのタブが保存されうる。ここで例外になると一覧全体が落ちる(#192)
  test('urlが空文字列でも例外にならず描画する', async (): Promise<void> => {
    await mount({ url: '', title: 'empty url title' });

    // 開けないタブはリンクにしない（クリックで空の新規タブが開いたうえで
    // タブが一覧から消えるため）。titleは読めるのでテキストとして表示する
    expect(container.querySelector('a.tab_link')).toBeNull();
    const title = container.querySelector<HTMLSpanElement>('span.tab_title')!;
    expect(title.textContent).toBe('empty url title');
  });

  test('urlが空文字列のタブはクリックしても開かない', async (): Promise<void> => {
    const openLinkClick = jest.fn();
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tab
          tab={{ url: '', title: 'empty url title' }}
          deleteClick={jest.fn()}
          editClick={jest.fn()}
          openLinkClick={openLinkClick}
          locked={false}
        />,
      );
    });

    const title = container.querySelector<HTMLSpanElement>('span.tab_title')!;
    await act(async () => {
      title.click();
    });

    expect(openLinkClick).not.toHaveBeenCalled();
  });

  test('編集アイコンのクリックでeditClickを呼ぶ', async (): Promise<void> => {
    const editClick = jest.fn();
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tab
          tab={{ url: 'https://example.com/', title: 'example title' }}
          deleteClick={jest.fn()}
          editClick={editClick}
          openLinkClick={jest.fn()}
          locked={false}
        />,
      );
    });

    const editIcon = container.querySelector<HTMLElement>('.tab_edit')!;
    await act(async () => {
      editIcon.click();
    });

    expect(editClick).toHaveBeenCalledTimes(1);
  });

  // ロック中のブロックのタブは編集・削除できない(#194)。
  // アイコンは消さずに無効化するため、押しても何も起きないことを確かめる
  test('ロック中は編集・削除アイコンを押しても何も起きない', async (): Promise<void> => {
    const editClick = jest.fn();
    const deleteClick = jest.fn();
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tab
          tab={{ url: 'https://example.com/', title: 'example title' }}
          deleteClick={deleteClick}
          editClick={editClick}
          openLinkClick={jest.fn()}
          locked={true}
        />,
      );
    });

    const editIcon = container.querySelector<HTMLElement>('.tab_edit')!;
    const closeIcon = container.querySelector<HTMLElement>('.tab_close')!;
    await act(async () => {
      editIcon.click();
      closeIcon.click();
    });

    expect(editClick).not.toHaveBeenCalled();
    expect(deleteClick).not.toHaveBeenCalled();
    expect(editIcon.getAttribute('aria-disabled')).toBe('true');
    expect(closeIcon.getAttribute('aria-disabled')).toBe('true');
  });

  // ロックしても保存したページを見に行けなくなっては困る
  test('ロック中でもリンクのクリックでopenLinkClickを呼ぶ', async (): Promise<void> => {
    const openLinkClick = jest.fn();
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tab
          tab={{ url: 'https://example.com/', title: 'example title' }}
          deleteClick={jest.fn()}
          editClick={jest.fn()}
          openLinkClick={openLinkClick}
          locked={true}
        />,
      );
    });

    const link = container.querySelector<HTMLAnchorElement>('a.tab_link')!;
    await act(async () => {
      link.click();
    });

    expect(openLinkClick).toHaveBeenCalledTimes(1);
  });

  // urlが空のタブは開けないが、編集で正しいURLに直せる導線は残す必要がある
  test('urlが空文字列のタブにも編集アイコンを表示する', async (): Promise<void> => {
    await mount({ url: '', title: 'empty url title' });

    expect(container.querySelector('.tab_edit')).not.toBeNull();
  });

  test('&を含むタイトルとURLを二重エスケープせず表示する', async (): Promise<void> => {
    await mount({
      url: 'https://example.com/?a=1&b=2',
      title: 'A & B',
    });

    const link = container.querySelector<HTMLAnchorElement>('a.tab_link')!;
    expect(link.textContent).toBe('A & B');
    expect(link.getAttribute('href')).toBe('https://example.com/?a=1&b=2');
    expect(link.getAttribute('data-url')).toBe('https://example.com/?a=1&b=2');
    expect(link.getAttribute('data-title')).toBe('A & B');
  });
  // 保存時のタブグループ(#191)。「すべてのリンクを開く」で名前と色ごと
  // 戻ることが一覧で分かるように出す
  describe('タブグループ', (): void => {
    const tab = { url: 'https://example.com/a', title: 'title-a' };

    test('グループのないタブにはチップを出さない', async (): Promise<void> => {
      await mount(tab);

      expect(container.querySelector('.tab-group-chip')).toBeNull();
    });

    test('グループ名と色をチップで出す', async (): Promise<void> => {
      await mount(tab, { title: '調査中', color: 'blue' });

      const chip = container.querySelector('.tab-group-chip')!;
      expect(chip.textContent).toBe('調査中');
      // 色だけで区別させず、色は補助にとどめる
      expect(chip.getAttribute('data-tab-group-color')).toBe('blue');
    });

    // Chromeでは名前を付けずに色だけのグループを作れる
    test('名前のないグループはその旨を出す', async (): Promise<void> => {
      await mount(tab, { color: 'red' });

      const chip = container.querySelector('.tab-group-chip')!;
      expect(chip.textContent).toBe('content_msg_tab_group_unnamed');
      expect(chip.getAttribute('data-tab-group-color')).toBe('red');
    });
  });
});

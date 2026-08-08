/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Tab } from './tab';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Tab', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (tab: { url: string; title: string }): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tab tab={tab} deleteClick={jest.fn()} openLinkClick={jest.fn()} />,
      );
    });
  };

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
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

  // urlが空文字列のタブでもgetDomainが例外を投げないことの回帰テスト。
  // 投げるとErrorBoundaryがMainごと落として一覧全体が表示されなくなる
  test('urlが空文字列でも例外にならず表示する', async (): Promise<void> => {
    await mount({ url: '', title: 'no url' });

    const link = container.querySelector<HTMLAnchorElement>('a.tab_link')!;
    expect(link.textContent).toBe('no url');
    // ドメインを取れないタブのファビコンは空白扱いになる
    expect(container.querySelector('img')!.getAttribute('src')).toBe(
      'https://www.google.com/s2/favicons?domain=%20',
    );
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
});

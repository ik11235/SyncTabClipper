/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Block from './block';
import { model } from '../types/interface';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('Block', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (
    tabs: model.Tab[],
    updateBlock: (newBlock: model.Block) => Promise<void>,
  ): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Block
          block={{
            indexNum: 0,
            createdAt: new Date('2021-01-02T03:04:05.678Z'),
            tabs: tabs,
          }}
          updateBlock={updateBlock}
        />,
      );
    });
  };

  const openEditModal = async (index: number): Promise<void> => {
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tab_edit')[index]!.click();
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

  test('編集アイコンで対象のタブの編集モーダルを開く', async (): Promise<void> => {
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      jest.fn().mockResolvedValue(undefined),
    );

    expect(container.querySelector('.edit-tab-modal')).toBeNull();

    await openEditModal(1);

    expect(
      container.querySelector<HTMLInputElement>('.edit-tab-title')!.value,
    ).toBe('title-b');
  });

  test('編集した内容を該当のタブだけに反映してupdateBlockを呼ぶ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
    );

    await openEditModal(0);
    const titleInput =
      container.querySelector<HTMLInputElement>('.edit-tab-title')!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setter.call(titleInput, 'renamed-a');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-save')!.click();
    });

    expect(updateBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        indexNum: 0,
        tabs: [
          { url: 'https://example.com/a', title: 'renamed-a' },
          { url: 'https://example.com/b', title: 'title-b' },
        ],
      }),
    );
    expect(container.querySelector('.edit-tab-modal')).toBeNull();
  });

  // 編集対象はindexで持っているため、モーダルを開いている間にこのブロックの
  // タブが増減すると、別のタブを上書きしたり、後から着地した保存が消した
  // はずのタブを書き戻したりする。オーバーレイはクリックしか遮らないので、
  // 背後をinertにしてキーボードからも触れないようにしている
  test('編集モーダルを開いている間は背後のタブ一覧を操作できない', async (): Promise<void> => {
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      jest.fn().mockResolvedValue(undefined),
    );

    const cardHeader = container.querySelector('.uk-card-header')!;
    const cardBody = container.querySelector('.uk-card-body')!;
    expect(cardHeader.hasAttribute('inert')).toBe(false);
    expect(cardBody.hasAttribute('inert')).toBe(false);

    await openEditModal(0);

    // タブのリンクも「すべてのリンクを開く/閉じる」も背後にあり、
    // どちらもblock.tabsを書き換える
    expect(cardHeader.hasAttribute('inert')).toBe(true);
    expect(cardBody.hasAttribute('inert')).toBe(true);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-cancel')!.click();
    });

    expect(cardHeader.hasAttribute('inert')).toBe(false);
    expect(cardBody.hasAttribute('inert')).toBe(false);
  });

  test('キャンセルすると保存せずモーダルを閉じる', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await openEditModal(0);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-cancel')!.click();
    });

    expect(updateBlock).not.toHaveBeenCalled();
    expect(container.querySelector('.edit-tab-modal')).toBeNull();
  });

  // 保存に失敗したブロックのタブ一覧を操作できてしまうと、失敗した保存の
  // 再試行と操作の結果が同じ古い配列から派生して互いを打ち消す
  test('保存に失敗している間もモーダルは開いたままで背後は操作できない', async (): Promise<void> => {
    const updateBlock = jest
      .fn()
      .mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await openEditModal(0);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-save')!.click();
    });

    expect(container.querySelector('.edit-tab-modal')).not.toBeNull();
    expect(
      container.querySelector('.uk-card-body')!.hasAttribute('inert'),
    ).toBe(true);
  });
});

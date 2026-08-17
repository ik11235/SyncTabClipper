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
    title?: string,
  ): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Block
          block={{
            indexNum: 0,
            createdAt: new Date('2021-01-02T03:04:05.678Z'),
            tabs: tabs,
            title: title,
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

  const openTitleEditor = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLElement>('.block_title_edit')!.click();
    });
  };

  // 制御されたinputはvalueの代入だけではReactに変更が伝わらないため、
  // ネイティブのsetterで値を入れてからinputイベントを発火させる
  const typeTitle = async (value: string): Promise<void> => {
    const input =
      container.querySelector<HTMLInputElement>('.block-title-input')!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const saveTitle = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.block-title-save')!.click();
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

  test('名前のないブロックの見出しはタブ数になる', async (): Promise<void> => {
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      jest.fn().mockResolvedValue(undefined),
    );

    expect(container.querySelector('.block_title')!.textContent).toBe(
      'content_msg_tab_length',
    );
  });

  // 名前を付けると見出しからタブ数が消えるため、タブ数は作成日と並ぶ
  // メタ情報として常に出す
  test('名前があれば見出しに名前を出し、タブ数はメタ情報に残る', async (): Promise<void> => {
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      jest.fn().mockResolvedValue(undefined),
      '調査中のタブ',
    );

    expect(container.querySelector('.block_title')!.textContent).toBe(
      '調査中のタブ',
    );
    expect(container.querySelector('.block_tab_count')!.textContent).toBe(
      'content_msg_tab_count',
    );
  });

  test('編集アイコンで現在の名前を入れた入力欄を開く', async (): Promise<void> => {
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      jest.fn().mockResolvedValue(undefined),
      '調査中のタブ',
    );

    expect(container.querySelector('.block-title-input')).toBeNull();

    await openTitleEditor();

    expect(
      container.querySelector<HTMLInputElement>('.block-title-input')!.value,
    ).toBe('調査中のタブ');
  });

  test('名前を保存するとタブを保ったままtitle付きでupdateBlockを呼ぶ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
    );

    await openTitleEditor();
    // 前後の空白は名前として意味がないため落とす
    await typeTitle('  調査中のタブ  ');
    await saveTitle();

    expect(updateBlock).toHaveBeenCalledWith({
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      title: '調査中のタブ',
    });
    expect(container.querySelector('.block-title-input')).toBeNull();
  });

  // 名前はタブのリンク名と違ってクリックの可否に関わらないため必須にせず、
  // 空欄での保存を「名前を消す」操作として扱う
  test('空欄で保存すると名前を消す', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      '調査中のタブ',
    );

    await openTitleEditor();
    await typeTitle('   ');
    await saveTitle();

    expect(updateBlock).toHaveBeenCalledWith(
      expect.objectContaining({ title: undefined }),
    );
    expect(container.querySelector('.block-title-input')).toBeNull();
  });

  test('名前の編集をキャンセルすると保存せず入力も残らない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      '調査中のタブ',
    );

    await openTitleEditor();
    await typeTitle('捨てる名前');
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.block-title-cancel')!
        .click();
    });

    expect(updateBlock).not.toHaveBeenCalled();
    expect(container.querySelector('.block_title')!.textContent).toBe(
      '調査中のタブ',
    );

    // 次に開いたときに前回の入力が残っていると、意図しない名前を保存しうる
    await openTitleEditor();
    expect(
      container.querySelector<HTMLInputElement>('.block-title-input')!.value,
    ).toBe('調査中のタブ');
  });

  test('名前の保存に失敗したら入力を残したままカード内でエラーを伝える', async (): Promise<void> => {
    const updateBlock = jest
      .fn()
      .mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await openTitleEditor();
    await typeTitle('調査中のタブ');
    await saveTitle();

    expect(
      container.querySelector<HTMLInputElement>('.block-title-input')!.value,
    ).toBe('調査中のタブ');
    expect(container.querySelector('.block-title-error')!.textContent).toBe(
      'content_msg_edit_block_title_save_failed',
    );
    // 再試行できる状態に戻す
    expect(
      container.querySelector<HTMLButtonElement>('.block-title-save')!.disabled,
    ).toBe(false);
  });

  // 名前の保存はブロックごと書き戻すため、タブを増減する操作と競合すると
  // 後から着地した側が相手の変更を打ち消す
  test('名前を編集している間はブロックを書き換える導線を止める', async (): Promise<void> => {
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      jest.fn().mockResolvedValue(undefined),
    );

    const actions = container.querySelector('.uk-card-header .uk-grid')!;
    const cardBody = container.querySelector('.uk-card-body')!;
    expect(actions.hasAttribute('inert')).toBe(false);
    expect(cardBody.hasAttribute('inert')).toBe(false);

    await openTitleEditor();

    // 「すべてのリンクを開く/閉じる」もタブ行の削除・編集もblock.tabsを書き換える
    expect(actions.hasAttribute('inert')).toBe(true);
    expect(cardBody.hasAttribute('inert')).toBe(true);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.block-title-cancel')!
        .click();
    });

    expect(actions.hasAttribute('inert')).toBe(false);
    expect(cardBody.hasAttribute('inert')).toBe(false);
  });

  // updateBlockはブロックごと書き戻すため、タブだけを変える導線が名前を
  // 引き継がないと操作のたびに名前が消える
  test('タブを削除しても名前を引き継ぐ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
      '調査中のタブ',
    );

    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tab_close')[0]!.click();
    });

    expect(updateBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [{ url: 'https://example.com/b', title: 'title-b' }],
        title: '調査中のタブ',
      }),
    );
  });
});

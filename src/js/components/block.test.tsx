/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Block from './block';
import { chromeService } from '../chromeService';
import { model } from '../types/interface';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Appは「更新内容」ではなく「更新関数」を受け取り、書き込む直前の一覧から
// 現在のブロックを渡す。テストでは直近にレンダリングしたブロックを
// そのまま現在の内容として扱う
type UpdateBlock = (
  indexNum: number,
  update: (current: model.Block) => model.Block,
) => Promise<void>;

let renderedBlock: model.Block;

// updateBlockに渡された更新関数を適用して、storageへ書かれる内容を得る。
// currentを省いたときはレンダリングしたブロックを現在の内容として扱う。
// 「クリック時のpropsではなく書き込む直前の内容に載せる」ことを確かめる
// テストでは、propsとは別の内容をcurrentとして渡す
const savedBlock = (
  updateBlock: jest.Mock,
  options: { current?: model.Block; callIndex?: number } = {},
): model.Block =>
  updateBlock.mock.calls[options.callIndex ?? 0]![1](
    options.current ?? renderedBlock,
  ) as model.Block;

// updateBlockに渡されたindexNum
const savedIndexNum = (updateBlock: jest.Mock, callIndex = 0): number =>
  updateBlock.mock.calls[callIndex]![0] as number;

describe('Block', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (
    tabs: model.Tab[],
    updateBlock: UpdateBlock,
    title?: string,
  ): Promise<void> => {
    renderedBlock = {
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: tabs,
      title: title,
    };
    await act(async () => {
      root = createRoot(container);
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
    });
  };

  const openEditModal = async (index: number): Promise<void> => {
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tab_edit')[index]!.click();
    });
  };

  const openTitleEditor = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLElement>('.block-title-edit')!.click();
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

    expect(savedBlock(updateBlock)).toStrictEqual(
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

  // モーダル経由の保存もブロックごと書き戻すため、ブロックの名前を
  // 引き継がないとタブを1件直すだけで名前が消える
  test('タブの編集で保存してもブロックの名前を引き継ぐ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      '調査中のタブ',
    );

    await openEditModal(0);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.edit-tab-save')!.click();
    });

    expect(savedBlock(updateBlock)).toStrictEqual(
      expect.objectContaining({ title: '調査中のタブ' }),
    );
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

    expect(container.querySelector('.block-title')!.textContent).toBe(
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

    expect(container.querySelector('.block-title')!.textContent).toBe(
      '調査中のタブ',
    );
    expect(container.querySelector('.block-tab-count')!.textContent).toBe(
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

    expect(savedBlock(updateBlock)).toStrictEqual({
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

    expect(savedBlock(updateBlock).title).toBeUndefined();
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
    expect(container.querySelector('.block-title')!.textContent).toBe(
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

    expect(savedBlock(updateBlock)).toStrictEqual(
      expect.objectContaining({
        tabs: [{ url: 'https://example.com/b', title: 'title-b' }],
        title: '調査中のタブ',
      }),
    );
  });

  // 編集をやめたときのフォーカス復帰がマウント時にも走ると、ブロックがN枚
  // 並んだページで初回描画のたびに最後のカードへフォーカスが飛んでスクロールする
  test('マウントしただけではフォーカスを奪わない', async (): Promise<void> => {
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      jest.fn().mockResolvedValue(undefined),
    );

    expect(document.activeElement).toBe(document.body);
  });

  // 名前を付けるのはこの機能の主導線なので、キーボードだけの利用者から
  // 到達できないと機能そのものが使えない
  test('名前の編集はキーボードから開けて、やめるとフォーカスが戻る', async (): Promise<void> => {
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      jest.fn().mockResolvedValue(undefined),
    );

    const editButton =
      container.querySelector<HTMLButtonElement>('.block-title-edit')!;
    // spanと違いbutton要素はTabキーで到達でき、Enter/Spaceでclickが起きる
    expect(editButton.tagName).toBe('BUTTON');

    editButton.focus();
    await act(async () => {
      editButton.click();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.block-title-cancel')!
        .click();
    });

    expect(document.activeElement).toBe(
      container.querySelector('.block-title-edit'),
    );
  });

  // 保存は非同期なので、待っている間にユーザーが別の要素へフォーカスを
  // 移していることがある。そこから奪い返すと入力先が飛ぶ
  test('保存を待っている間にフォーカスを移していたら奪い返さない', async (): Promise<void> => {
    let resolveSave: () => void = () => {};
    const updateBlock = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await openTitleEditor();
    await typeTitle('調査中のタブ');
    await saveTitle();

    // カードの外にある要素へフォーカスを移す
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();
    try {
      await act(async () => {
        resolveSave();
      });

      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  test('Escapeキーで名前の編集をやめる', async (): Promise<void> => {
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
        .querySelector<HTMLInputElement>('.block-title-input')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
    });

    expect(updateBlock).not.toHaveBeenCalled();
    expect(container.querySelector('.block-title-input')).toBeNull();
  });

  // 保存中にEscapeで閉じられると、書き込みの結果を受け取る相手がいなくなる
  test('名前の保存中はEscapeキーで閉じない', async (): Promise<void> => {
    // 決着させないPromiseを返して保存中の状態に留める
    const updateBlock = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await openTitleEditor();
    await typeTitle('調査中のタブ');
    await saveTitle();
    await act(async () => {
      container
        .querySelector<HTMLInputElement>('.block-title-input')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
    });

    expect(container.querySelector('.block-title-input')).not.toBeNull();
  });
});

// 名前もタブもブロックごと書き戻すため、両者が並行すると後から着地した側が
// 相手の変更を打ち消す（名前が消える・開いたタブが一覧に戻る）。飛行中の
// 書き込みはpropsから分からないので、同時に始められないようにして塞いでいる。
// タブを開く導線はchrome.tabs.createの解決も待つため窓が長い
describe('Block タブ操作と名前の編集の排他', (): void => {
  let container: HTMLDivElement;
  let root: Root;
  let createTabsSpy: jest.SpyInstance;
  // タブが開き終わるタイミングを操作するため、解決を手元に持つ
  let resolveCreateTabs: () => void;

  const mount = async (
    tabs: model.Tab[],
    updateBlock: UpdateBlock,
  ): Promise<void> => {
    renderedBlock = {
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: tabs,
    };
    await act(async () => {
      root = createRoot(container);
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
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
    resolveCreateTabs = () => {};
    createTabsSpy = jest.spyOn(chromeService.tab, 'createTabs').mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCreateTabs = resolve;
      }),
    );
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    createTabsSpy.mockRestore();
  });

  test('タブを開いている間は名前の編集を始められない', async (): Promise<void> => {
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      jest.fn().mockResolvedValue(undefined),
    );

    const editButton =
      container.querySelector<HTMLButtonElement>('.block-title-edit')!;
    expect(editButton.disabled).toBe(false);

    // 1件目のリンクを開く。chrome.tabs.createは保留のままにする
    await act(async () => {
      container.querySelector<HTMLElement>('.tab_link')!.click();
    });

    expect(
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.disabled,
    ).toBe(true);
  });

  // 開き終わってから書き戻すまでを1つの操作として数えないと、その隙に
  // 名前の編集を始められてしまう
  test('タブを開き終わって書き戻しが決着するまで名前の編集を始められない', async (): Promise<void> => {
    let resolveUpdate: () => void = () => {};
    const updateBlock = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.tab_link')!.click();
    });
    // タブは開き終わったが、storageへの書き戻しはまだ決着していない
    await act(async () => {
      resolveCreateTabs();
    });
    expect(updateBlock).toHaveBeenCalledTimes(1);

    expect(
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.disabled,
    ).toBe(true);

    await act(async () => {
      resolveUpdate();
    });

    expect(
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.disabled,
    ).toBe(false);
  });

  test('「すべてのリンクを開く」の最中も名前の編集を始められない', async (): Promise<void> => {
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      jest.fn().mockResolvedValue(undefined),
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.all_tab_link')!.click();
    });

    expect(
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.disabled,
    ).toBe(true);
  });

  // 逆向き。名前の保存が決着するまでタブを書き換える導線を止める
  test('名前を保存している間はタブを書き換える導線が止まる', async (): Promise<void> => {
    // 決着させないPromiseを返して保存中の状態に留める
    const updateBlock = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.block-title-edit')!.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.block-title-save')!.click();
    });

    expect(
      container
        .querySelector('.uk-card-header .uk-grid')!
        .hasAttribute('inert'),
    ).toBe(true);
    expect(
      container.querySelector('.uk-card-body')!.hasAttribute('inert'),
    ).toBe(true);
    expect(createTabsSpy).not.toHaveBeenCalled();
  });
});

// ロックはブロックを誤って削除・変更しないための保護(#194)。
// 「URLを開いてもブロックを消さない」「削除・編集系の導線を止める」の2点を守る
describe('Block 編集のロック', (): void => {
  let container: HTMLDivElement;
  let root: Root;
  let createTabsSpy: jest.SpyInstance;

  const mount = async (
    tabs: model.Tab[],
    updateBlock: UpdateBlock,
    locked?: boolean,
    title?: string,
  ): Promise<void> => {
    renderedBlock = {
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: tabs,
      title: title,
      locked: locked,
    };
    await act(async () => {
      root = createRoot(container);
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
    });
  };

  const clickLockToggle = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.block-lock-toggle')!.click();
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
    createTabsSpy = jest
      .spyOn(chromeService.tab, 'createTabs')
      .mockResolvedValue(undefined);
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    createTabsSpy.mockRestore();
  });

  test('ロック中はリンクを開いてもタブを一覧から消さない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    await act(async () => {
      container.querySelector<HTMLAnchorElement>('a.tab_link')!.click();
    });

    expect(createTabsSpy).toHaveBeenCalledWith({
      url: 'https://example.com/a',
      active: false,
    });
    expect(updateBlock).not.toHaveBeenCalled();
    expect(container.querySelectorAll('a.tab_link')).toHaveLength(1);
  });

  test('ロック中は「すべてのリンクを開く」でもタブを一覧から消さない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
      true,
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.all_tab_link')!.click();
    });

    expect(createTabsSpy).toHaveBeenCalledTimes(2);
    expect(updateBlock).not.toHaveBeenCalled();
  });

  test('ロック中はブロックの削除と名前の編集を止める', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.block-delete')!.click();
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.click();
    });

    expect(updateBlock).not.toHaveBeenCalled();
    expect(container.querySelector('.block-title-input')).toBeNull();
    expect(
      container
        .querySelector<HTMLButtonElement>('.block-title-edit')!
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLElement>('.block-delete')!
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  test('ロックしてもタブと名前を保ったままupdateBlockを呼ぶ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      undefined,
      '調査中のタブ',
    );

    await clickLockToggle();

    expect(savedBlock(updateBlock)).toStrictEqual({
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: [{ url: 'https://example.com/a', title: 'title-a' }],
      title: '調査中のタブ',
      locked: true,
    });
  });

  test('ロックを解除するとlockedを落としてupdateBlockを呼ぶ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    await clickLockToggle();

    // objectContainingはキーの有無を区別しないため、値そのものを確かめる
    // （lockedを持ったまま渡すとblockToJsonObjが"locked":trueを書き続ける）
    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(savedBlock(updateBlock).locked).toBeUndefined();
  });

  // App側のアラートはページ最上部に出るため、スクロール中は気付けない。
  // 押しても状態が変わらない理由をカード内でも伝える
  test('ロックの保存に失敗したらカード内でエラーを伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockRejectedValue(new Error('failed'));
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await clickLockToggle();

    const error = container.querySelector('.block-lock-error')!;
    expect(error).not.toBeNull();
    expect(error.getAttribute('role')).toBe('alert');
  });

  test('ロック中はタブの編集・削除アイコンを押しても何も起きない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
      true,
    );

    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tab_edit')[0]!.click();
      container.querySelectorAll<HTMLElement>('.tab_close')[0]!.click();
    });

    expect(updateBlock).not.toHaveBeenCalled();
    expect(container.querySelector('.edit-tab-modal')).toBeNull();
    expect(container.querySelectorAll('a.tab_link')).toHaveLength(2);
  });

  // 壊れたタブの削除もタブ配列の書き換えなので、ロック中は止める
  test('ロック中は壊れたタブも削除できない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [
        // urlを持たないタブは壊れたタブとして表示される
        { title: 'broken' } as unknown as model.Tab,
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
      true,
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.broken_tab_close')!.click();
    });

    expect(updateBlock).not.toHaveBeenCalled();
  });

  // 見えているツールチップと支援技術に伝わる名前が食い違うと、
  // 音声操作でツールチップの文言を読み上げても操作できない
  test('ロックの状態をアイコンと名前で伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    const button =
      container.querySelector<HTMLButtonElement>('.block-lock-toggle')!;
    expect(button.getAttribute('data-uk-icon')).toBe('icon: lock; ratio: 0.9');
    expect(button.getAttribute('title')).toBe('content_msg_unlock_block');
    expect(button.getAttribute('aria-label')).toBe('content_msg_unlock_block');
  });

  // アイコンの形だけではロック中か一目で分からないという指摘への対応。
  // 見出し横のバッジとボタンの塗り分けの2点で状態を示す
  test('ロック中はバッジとボタンで状態を示す', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    // バッジは見出しと同じ行に出す
    expect(
      container.querySelector('.uk-card-title .block-locked-badge')!
        .textContent,
    ).toBe('content_msg_locked_badge');
    expect(
      container
        .querySelector<HTMLElement>('.block-lock-toggle')!
        .getAttribute('data-locked'),
    ).toBe('true');
  });

  test('ロックしていないブロックにはロックの表示を出さない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    expect(container.querySelector('.block-locked-badge')).toBeNull();
    expect(
      container
        .querySelector<HTMLElement>('.block-lock-toggle')!
        .getAttribute('data-locked'),
    ).toBe('false');
  });

  // data-uk-iconを持つ要素のclassNameをロックで切り替えると、UIkitが付けた
  // uk-iconごとReactに書き換えられ、アイコンの色と行の高さが崩れたまま戻らない
  test('ロック中もアイコンのclassNameは変えず、無効はaria-disabledで表す', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    const editIcon = container.querySelector<HTMLElement>('.tab_edit')!;
    const closeIcon = container.querySelector<HTMLElement>('.tab_close')!;
    // 未ロックのときと同じclassNameであることを見る。ロックで差し替えると
    // UIkitが付けたuk-iconごとReactに書き換えられるため。
    // uk-iconの保全そのものはUIkitを動かしていないjsdomでは検証できない
    expect(editIcon.classList.contains('uk-link')).toBe(true);
    expect(closeIcon.classList.contains('uk-link')).toBe(true);
    expect(editIcon.getAttribute('aria-disabled')).toBe('true');
    expect(closeIcon.getAttribute('aria-disabled')).toBe('true');
  });

  // ロックの書き込みが着地するまでpropsのlockedは古いままで、その間に
  // 始まったタブ操作はロックを知らないまま書き戻す。tabs:[]の書き戻しは
  // storage側でブロックの削除になるため、ロックしたばかりのブロックが消える
  test('ロックの保存中はタブを書き換える導線が止まる', async (): Promise<void> => {
    // 決着させないPromiseを返して保存中の状態に留める
    const updateBlock = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await clickLockToggle();

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(
      container
        .querySelector('.uk-card-header .uk-grid')!
        .hasAttribute('inert'),
    ).toBe(true);
    expect(
      container.querySelector('.uk-card-body')!.hasAttribute('inert'),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLButtonElement>('.block-title-edit')!
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  // ロックもブロックごと書き戻すため、名前の編集と並行すると
  // 後から着地した側が相手の変更を打ち消す
  test('名前を編集している間はロックを切り替えられない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.click();
    });
    await clickLockToggle();

    expect(updateBlock).not.toHaveBeenCalled();
    expect(
      container
        .querySelector<HTMLButtonElement>('.block-lock-toggle')!
        .hasAttribute('disabled'),
    ).toBe(true);
  });
  // お気に入りと違いカードが動かないため、スクロールを抑えない。
  // 画面外のボタンへフォーカスが戻ったときは、見えるところまで運んでほしい。
  // 共通のフックへ寄せたあとも、お気に入りとの違いが残ることを固定する(#254)
  test('キーボードのフォーカス復帰でスクロールを抑えない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );
    const focusSpy = jest.spyOn(
      container.querySelector<HTMLButtonElement>('.block-lock-toggle')!,
      'focus',
    );

    await clickLockToggle();

    // 引数の形ではなく「抑えていないこと」を見る。
    // 等価なfocus()に戻す実装でも通ってほしい
    expect(focusSpy).toHaveBeenCalled();
    expect(focusSpy.mock.calls[0]?.[0]?.preventScroll).not.toBe(true);
  });
});

describe('Block お気に入り', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (
    updateBlock: UpdateBlock,
    block?: Partial<model.Block>,
  ): Promise<void> => {
    renderedBlock = {
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: [{ url: 'https://example.com/a', title: 'title-a' }],
      ...block,
    };
    await act(async () => {
      root = createRoot(container);
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
    });
  };

  const clickStarToggle = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.block-star-toggle')!.click();
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

  test('お気に入りにするとタブ・名前・ロックを保ったままupdateBlockを呼ぶ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { title: '調査中のタブ', locked: true });

    await clickStarToggle();

    expect(savedBlock(updateBlock)).toStrictEqual({
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: [{ url: 'https://example.com/a', title: 'title-a' }],
      title: '調査中のタブ',
      locked: true,
      starred: true,
    });
  });

  test('お気に入りを解除するとstarredを落としてupdateBlockを呼ぶ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { starred: true });

    await clickStarToggle();

    // objectContainingはキーの有無を区別しないため、値そのものを確かめる
    // （starredを持ったまま渡すとblockToJsonObjが"starred":trueを書き続ける）
    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(savedBlock(updateBlock).starred).toBeUndefined();
  });

  // お気に入りは並び順と装飾しか変えないため、タブを失う操作を止めるための
  // ロックの対象にしない
  test('ロック中でもお気に入りは付け外しできる', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { locked: true });

    expect(
      container
        .querySelector<HTMLButtonElement>('.block-star-toggle')!
        .hasAttribute('disabled'),
    ).toBe(false);

    await clickStarToggle();

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(savedBlock(updateBlock).starred).toBe(true);
  });

  // 色やアイコンの形だけの強調にならないよう、リボンには文字も入れる
  test('お気に入りのブロックにはリボンを出す', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { starred: true });

    expect(container.querySelector('.block-star-ribbon')!.textContent).toBe(
      'content_msg_starred_ribbon',
    );
    expect(
      container
        .querySelector<HTMLElement>('.block-star-toggle')!
        .getAttribute('data-starred'),
    ).toBe('true');
  });

  test('お気に入りでないブロックにはリボンを出さない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    expect(container.querySelector('.block-star-ribbon')).toBeNull();
    expect(
      container
        .querySelector<HTMLElement>('.block-star-toggle')!
        .getAttribute('data-starred'),
    ).toBe('false');
  });

  test('お気に入りの状態を名前で伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { starred: true });

    const button =
      container.querySelector<HTMLButtonElement>('.block-star-toggle')!;
    expect(button.getAttribute('title')).toBe('content_msg_unstar_block');
    expect(button.getAttribute('aria-label')).toBe('content_msg_unstar_block');
  });

  // App側のアラートはページ最上部に出るため、スクロール中は気付けない
  test('お気に入りの保存に失敗したらカード内でエラーを伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockRejectedValue(new Error('failed'));
    await mount(updateBlock);

    await clickStarToggle();

    const error = container.querySelector('.block-star-error')!;
    // 文言のキーまで見る。別の操作のキーを取り違えても件数や属性だけでは通る
    expect(error.textContent).toBe('content_msg_star_block_save_failed');
    expect(error.getAttribute('role')).toBe('alert');
  });

  // 再試行している間も古い赤字が残っていると、まだ失敗しているように見える
  test('お気に入りを押し直すと前回の失敗の赤字は消える', async (): Promise<void> => {
    const updateBlock = jest
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      // 2回目は決着させず、飛行中の状態で赤字が消えていることを見る
      .mockReturnValue(new Promise<void>(() => {}));
    await mount(updateBlock);

    await clickStarToggle();
    expect(container.querySelector('.block-star-error')).not.toBeNull();

    await clickStarToggle();

    expect(updateBlock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.block-star-error')).toBeNull();
  });

  // 別の操作が成功してブロックが書き換わったら、前の失敗の赤字は
  // 現在の状態を説明していない
  test('ブロックが書き換わるとお気に入りのエラーは消える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockRejectedValue(new Error('failed'));
    await mount(updateBlock);

    await clickStarToggle();
    expect(container.querySelector('.block-star-error')).not.toBeNull();

    // 別の操作が成功して新しいblockがpropsで降りてきた状況を作る
    await act(async () => {
      root.render(
        <Block
          block={{
            indexNum: 0,
            createdAt: new Date('2021-01-02T03:04:05.678Z'),
            tabs: [{ url: 'https://example.com/a', title: 'title-a' }],
            title: '名前を付けた',
          }}
          updateBlock={updateBlock}
        />,
      );
    });

    expect(container.querySelector('.block-star-error')).toBeNull();
  });

  // ロックと同じ理由。着地するまでpropsのstarredは古いままで、その間に
  // 始まったタブ操作はお気に入りを知らないまま書き戻す
  test('お気に入りの保存中はタブを書き換える導線が止まる', async (): Promise<void> => {
    // 決着させないPromiseを返して保存中の状態に留める
    const updateBlock = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    await mount(updateBlock);

    await clickStarToggle();

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(
      container
        .querySelector('.uk-card-header .uk-grid')!
        .hasAttribute('inert'),
    ).toBe(true);
    expect(
      container.querySelector('.uk-card-body')!.hasAttribute('inert'),
    ).toBe(true);
    expect(
      container
        .querySelector<HTMLButtonElement>('.block-lock-toggle')!
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  test('名前を編集している間はお気に入りを切り替えられない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.block-title-edit')!.click();
    });
    await clickStarToggle();

    expect(updateBlock).not.toHaveBeenCalled();
    expect(
      container
        .querySelector<HTMLButtonElement>('.block-star-toggle')!
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  // タブの編集モーダル中はボタンのdisabledではなくヘッダのinertで塞いでいる。
  // inertはjsdomが実装しておらず、実ブラウザでもDOMの属性でしかないため、
  // ハンドラ側のガードが唯一の防御になる
  test('タブの編集モーダルを開いている間はお気に入りを切り替えられない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await act(async () => {
      container.querySelector<HTMLElement>('.tab_edit')!.click();
    });
    expect(container.querySelector('.edit-tab-modal')).not.toBeNull();

    await clickStarToggle();

    expect(updateBlock).not.toHaveBeenCalled();
  });

  // ロック中バッジとリボンは別のレイヤに置いているため、両方付いたブロックで
  // 片方が消えたり重なったりしない
  test('ロック中かつお気に入りのブロックは両方の表示を出す', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { locked: true, starred: true });

    expect(container.querySelector('.block-star-ribbon')).not.toBeNull();
    expect(
      container.querySelector('.uk-card-title .block-locked-badge'),
    ).not.toBeNull();
  });

  // リボンは見た目専用でaria-hiddenにしているため、そのままでは支援技術に
  // お気に入りだと伝わらない。ロック中バッジと同じく見出しの中で伝える
  test('お気に入りの状態を見出しの中でも支援技術に伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { starred: true });

    expect(
      container
        .querySelector<HTMLElement>('.block-star-ribbon')!
        .getAttribute('aria-hidden'),
    ).toBe('true');
    const status = container.querySelector(
      '.uk-card-title .block-starred-status',
    )!;
    expect(status.textContent).toBe('content_msg_starred_ribbon');
    // 見えている文字が二重にならないよう、視覚的には隠す
    expect(status.classList.contains('uk-hidden-visually')).toBe(true);
  });

  // フォーカスに伴うブラウザの瞬間スクロールは、useBlockMoveAnimationが
  // カードの移動に合わせて見せているスクロールを乱す。
  // ロック側は逆に抑えない（カードが動かないので抑える理由がなく、
  // 画面外のボタンへ戻ったときは見えるところまで運んでほしい）ので、
  // 共通のフックへ寄せたあとも違いが残っていることを固定する(#254)
  test('キーボードのフォーカス復帰でスクロールを起こさない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);
    const focusSpy = jest.spyOn(
      container.querySelector<HTMLButtonElement>('.block-star-toggle')!,
      'focus',
    );

    await clickStarToggle();

    expect(focusSpy.mock.calls[0]?.[0]?.preventScroll).toBe(true);
  });

  /**
   * スターボタンをクリックする。押した瞬間にボタンがdisabledになると
   * ブラウザはフォーカスをbodyへ落とすが、jsdomはそれをやらない。
   * ここではフォーカスを当てずに押すことで、復帰処理が走ったかどうかを
   * activeElementの変化として観測できる状態を作る
   * @param {number} detail クリックのdetail（0はキーボードからの起動）
   * @return {Promise<void>} クリックの反映を待つPromise
   */
  const dispatchStarClick = async (detail: number): Promise<void> => {
    expect(document.activeElement).toBe(document.body);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.block-star-toggle')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
    });
  };

  // ボタンは押した瞬間に自分がdisabledになるため、ブラウザがフォーカスを
  // bodyへ落とす。キーボードだけの利用者が操作位置を失わないよう戻す
  test('キーボードから切り替えたら決着後にフォーカスが戻る', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    // キーボードから起動したクリックはdetailが0になる
    await dispatchStarClick(0);

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(
      container.querySelector('.block-star-toggle'),
    );
  });

  // マウスで押してから別の場所をクリックした場合もフォーカスはbodyに落ちる。
  // そこで奪い返すと、見ている位置から勝手にスクロールが戻ってしまう
  test('マウスから切り替えたときはフォーカスを奪わない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await dispatchStarClick(1);

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.body);
  });
});

// 一覧はstorage.onChangedで読み直されるため(#249)、編集モーダルを開いている
// 間にこのブロックのタブが外から入れ替わることがある。編集対象はindexで
// 指しているので、そのまま書き戻すと無関係なタブを上書きする
describe('Block 編集中に外からタブが変わったとき', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * 指定したタブでBlockを描画する。2回目以降は同じrootへ描き直して、
   * 一覧の読み直しでpropsのタブが差し替わる状況を作る
   * @param {model.Tab[]} tabs 表示するタブ
   * @param {Function} updateBlock 保存の呼び出し先
   * @return {Promise<void>}
   */
  const render = async (
    tabs: model.Tab[],
    updateBlock: UpdateBlock,
  ): Promise<void> => {
    renderedBlock = {
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: tabs,
    };
    await act(async () => {
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
    });
  };

  const openEditModal = async (index: number): Promise<void> => {
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tab_edit')[index]!.click();
    });
  };

  const typeEditTitle = async (value: string): Promise<void> => {
    const input = container.querySelector<HTMLInputElement>('.edit-tab-title')!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const saveEdit = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLElement>('.edit-tab-save')!.click();
    });
  };

  const tabsOf = (updateBlock: jest.Mock): model.Tab[] =>
    savedBlock(updateBlock).tabs;

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  // 前のタブが消えるとindexの指す先が1つずれる。indexだけを頼りに書くと
  // 隣のタブを編集内容で上書きしてしまう
  test('編集対象の位置がずれても探し直して正しいタブへ保存する', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    const abc = [
      { url: 'https://example.com/a', title: 'title-a' },
      { url: 'https://example.com/b', title: 'title-b' },
      { url: 'https://example.com/c', title: 'title-c' },
    ];
    await render(abc, updateBlock);
    await openEditModal(2);
    await typeEditTitle('title-c-edited');

    // 他のtabsページ・他端末で先頭のタブが消えた
    await render(abc.slice(1), updateBlock);

    // モーダルは開いたままで、保存もできる
    expect(container.querySelector('.edit-tab-modal')).not.toBeNull();
    expect(container.querySelector('.edit-tab-target-lost')).toBeNull();
    await saveEdit();

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(tabsOf(updateBlock)).toEqual([
      { url: 'https://example.com/b', title: 'title-b' },
      { url: 'https://example.com/c', title: 'title-c-edited' },
    ]);
    // 保存できたらモーダルを閉じる
    expect(container.querySelector('.edit-tab-modal')).toBeNull();
  });

  // 同じページを2枚開いて保存すると、url・nameが同じタブが並ぶ。
  // 内容だけで探し直すと、常に先頭の重複を書き換えてしまう
  test('同じURL・同じ名前のタブが複数あっても押した行を書き換える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await render(
      [
        { url: 'https://example.com/x', title: 'title-x' },
        { url: 'https://example.com/x', title: 'title-x' },
        { url: 'https://example.com/c', title: 'title-c' },
      ],
      updateBlock,
    );

    // 2件目の鉛筆を押して編集する
    await openEditModal(1);
    await typeEditTitle('title-x-edited');
    await saveEdit();

    expect(tabsOf(updateBlock)).toEqual([
      { url: 'https://example.com/x', title: 'title-x' },
      { url: 'https://example.com/x', title: 'title-x-edited' },
      { url: 'https://example.com/c', title: 'title-c' },
    ]);
  });

  test('編集対象が消えたらモーダルは閉じず、保存だけを止める', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await render(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
    );
    await openEditModal(1);
    await typeEditTitle('title-b-edited');

    // 編集していたタブが外から消された
    await render(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );

    // 黙って消さない。書いていた内容は残したまま、保存だけを止める
    expect(container.querySelector('.edit-tab-modal')).not.toBeNull();
    expect(
      container.querySelector<HTMLInputElement>('.edit-tab-title')!.value,
    ).toBe('title-b-edited');
    expect(container.querySelector('.edit-tab-target-lost')).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('.edit-tab-save')!.disabled,
    ).toBe(true);

    await saveEdit();
    expect(updateBlock).not.toHaveBeenCalled();
  });

  test('編集対象が別のタブに入れ替わっても上書きしない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await render(
      [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      updateBlock,
    );
    await openEditModal(1);
    await typeEditTitle('title-b-edited');

    // インポートなどでブロックの中身が丸ごと入れ替わった
    await render(
      [
        { url: 'https://example.com/x', title: 'title-x' },
        { url: 'https://example.com/y', title: 'title-y' },
      ],
      updateBlock,
    );

    expect(container.querySelector('.edit-tab-target-lost')).not.toBeNull();
    await saveEdit();

    // title-yがtitle-b-editedで上書きされていない
    expect(updateBlock).not.toHaveBeenCalled();
  });

  // 編集中は背後を操作不能にしている。対象を失っても入力を残す以上、
  // 背後を触れるようにすると打ち消し合う書き込みを始められてしまう
  test('編集対象を失っても背後は操作不能のまま', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await render(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
    );
    await openEditModal(0);

    await render(
      [{ url: 'https://example.com/z', title: 'title-z' }],
      updateBlock,
    );

    expect(
      container
        .querySelector<HTMLElement>('.block-card-header')!
        .hasAttribute('inert'),
    ).toBe(true);
  });
});

// タブ単位の境界のkeyはurlを含むため、urlが変わったタブは再マウントされる。
// 同じurlのままtitleだけ直ったケースはkeyでは拾えない(#256)
describe('Block 落ちたタブの表示が読み直しで戻るか', (): void => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: jest.SpyInstance;

  const render = async (tabs: model.Tab[]): Promise<void> => {
    await act(async () => {
      root.render(
        <Block
          block={{
            indexNum: 0,
            createdAt: new Date('2021-01-02T03:04:05.678Z'),
            tabs: tabs,
          }}
          updateBlock={jest.fn().mockResolvedValue(undefined)}
        />,
      );
    });
  };

  // Reactの子として渡せない値。Tabのレンダリングが例外になる
  const brokenTitle = {} as unknown as string;

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      i18n: {
        getMessage: (key: string): string => key,
      },
    };
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  test('urlが同じままtitleだけ直ったタブも表示が戻る', async (): Promise<void> => {
    await render([
      { url: 'https://example.com/a', title: brokenTitle },
      { url: 'https://example.com/b', title: 'title-b' },
    ]);

    expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(1);

    // 他端末でtitleだけが直った（urlは変わらないのでkeyは同じ）
    await render([
      { url: 'https://example.com/a', title: 'title-a' },
      { url: 'https://example.com/b', title: 'title-b' },
    ]);

    expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(0);
    expect(container.textContent).toContain('title-a');
  });

  test('直っていないタブは読み直しごとに1回だけ再試行してカードのまま', async (): Promise<void> => {
    const broken = { url: 'https://example.com/a', title: brokenTitle };
    await render([broken, { url: 'https://example.com/b', title: 'title-b' }]);
    // 1回のレンダリング試行でReactがconsole.errorへ出す回数
    const perAttempt = consoleErrorSpy.mock.calls.length;

    // 壊れたまま読み直された（別のオブジェクトだが中身は同じ）
    for (let i = 0; i < 2; i += 1) {
      await render([
        { ...broken },
        { url: 'https://example.com/b', title: 'title-b' },
      ]);
    }

    expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(1);
    expect(container.textContent).toContain('title-b');
    // 読み直し2回で試行は3回まで。カードのままでも再試行が二重に走らない
    // （Reactが出すログを間接的に数えているため上限で見る）
    expect(consoleErrorSpy.mock.calls.length).toBeLessThanOrEqual(
      perAttempt * 3,
    );
  });
});

// この PR の核心は「クリック時のpropsではなく、書き込む直前の内容(current)に
// 変更を載せる」こと。propsと同じcurrentを渡すテストでは両者を区別できないので、
// ここではpropsとずれたcurrentを渡して確かめる(#248)
describe('Block 書き込む直前に内容が変わっていたとき', (): void => {
  let container: HTMLDivElement;
  let root: Root;

  // 画面に見えている内容
  const shownBlock: model.Block = {
    indexNum: 3,
    createdAt: new Date('2021-01-02T03:04:05.678Z'),
    tabs: [
      { url: 'https://example.com/a', title: 'title-a' },
      { url: 'https://example.com/b', title: 'title-b' },
    ],
    title: '見えている名前',
  };

  const mount = async (updateBlock: UpdateBlock): Promise<void> => {
    renderedBlock = shownBlock;
    await act(async () => {
      root = createRoot(container);
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
    });
  };

  const click = async (selector: string, index = 0): Promise<void> => {
    await act(async () => {
      container.querySelectorAll<HTMLElement>(selector)[index]!.click();
    });
  };

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      i18n: { getMessage: (key: string): string => key },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
  });

  test('どのブロックへの書き込みかをindexNumで伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await click('.tab_close', 0);

    expect(savedIndexNum(updateBlock)).toBe(3);
  });

  // タブを消すだけの導線でも、待っている間に他端末で変わった名前を
  // クリック時のものへ巻き戻してはいけない
  test('タブの削除は書き込む直前の名前を引き継ぐ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await click('.tab_close', 0);

    expect(
      savedBlock(updateBlock, {
        current: { ...shownBlock, title: '書き込む直前の名前' },
      }),
    ).toStrictEqual({
      ...shownBlock,
      tabs: [{ url: 'https://example.com/b', title: 'title-b' }],
      title: '書き込む直前の名前',
    });
  });

  test('名前の保存は書き込む直前のタブを引き継ぐ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await act(async () => {
      container.querySelector<HTMLElement>('.block-title-edit')!.click();
    });
    const input =
      container.querySelector<HTMLInputElement>('.block-title-input')!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setter.call(input, '新しい名前');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLElement>('.block-title-save')!.click();
    });

    const currentTabs = [{ url: 'https://example.com/c', title: 'title-c' }];
    expect(
      savedBlock(updateBlock, {
        current: { ...shownBlock, tabs: currentTabs },
      }),
    ).toStrictEqual({
      ...shownBlock,
      tabs: currentTabs,
      title: '新しい名前',
    });
  });

  test('ロックの切り替えは書き込む直前のタブを引き継ぐ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await click('.block-lock-toggle');

    const currentTabs = [{ url: 'https://example.com/c', title: 'title-c' }];
    expect(
      savedBlock(updateBlock, {
        current: { ...shownBlock, tabs: currentTabs },
      }),
    ).toStrictEqual({ ...shownBlock, tabs: currentTabs, locked: true });
  });

  test('お気に入りの切り替えは書き込む直前のタブを引き継ぐ', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await click('.block-star-toggle');

    const currentTabs = [{ url: 'https://example.com/c', title: 'title-c' }];
    expect(
      savedBlock(updateBlock, {
        current: { ...shownBlock, tabs: currentTabs },
      }),
    ).toStrictEqual({ ...shownBlock, tabs: currentTabs, starred: true });
  });

  // 押した時点で解除されていても、待っている間にロックされたブロックへ
  // 書き戻すと、ロックが守るはずだったタブを消してしまう
  test('書き込む直前にロックされていたらタブを書き換えない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await click('.tab_close', 0);

    expect(() =>
      savedBlock(updateBlock, {
        current: { ...shownBlock, locked: true },
      }),
    ).toThrow('This block is locked');
  });

  // 待っている間に他の操作で消えていたタブを消しにいくと、
  // 同じ位置の別のタブを巻き込む
  test('書き込む直前に対象のタブが消えていたら書き換えない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    // 1件目（title-a）の削除を押す
    await click('.tab_close', 0);

    expect(() =>
      savedBlock(updateBlock, {
        current: {
          ...shownBlock,
          tabs: [{ url: 'https://example.com/z', title: 'title-z' }],
        },
      }),
    ).toThrow('tab already removed');
  });

  // 編集対象はindexで持っているため、書き込む直前の一覧で指し直さないと
  // 別のタブを上書きする
  test('タブの編集は書き込む直前の一覧で対象を指し直す', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    // 2件目（title-b）を編集する
    await click('.tab_edit', 1);
    const input = container.querySelector<HTMLInputElement>('.edit-tab-title')!;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setter.call(input, 'renamed-b');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLElement>('.edit-tab-save')!.click();
    });

    // 書き込む直前には先頭にタブが増え、title-bの位置がずれている
    const inserted = { url: 'https://example.com/new', title: 'title-new' };
    expect(
      savedBlock(updateBlock, {
        current: { ...shownBlock, tabs: [inserted, ...shownBlock.tabs] },
      }).tabs,
    ).toStrictEqual([
      inserted,
      { url: 'https://example.com/a', title: 'title-a' },
      { url: 'https://example.com/b', title: 'renamed-b' },
    ]);
  });

  test('書き込む直前に編集対象が消えていたら書き換えない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await click('.tab_edit', 1);
    await act(async () => {
      container.querySelector<HTMLElement>('.edit-tab-save')!.click();
    });

    expect(() =>
      savedBlock(updateBlock, {
        current: {
          ...shownBlock,
          tabs: [{ url: 'https://example.com/a', title: 'title-a' }],
        },
      }),
    ).toThrow('edit target lost');
  });
});

// 「すべてのリンクを閉じる」はブロックの削除そのものだったが、
// リンクの見た目で他の操作に紛れており、確認もなく消えていた(#252)
describe('Block ブロックの削除', (): void => {
  let container: HTMLDivElement;
  let root: Root;
  let confirmSpy: jest.SpyInstance;

  const mount = async (
    updateBlock: UpdateBlock,
    block?: Partial<model.Block>,
  ): Promise<void> => {
    renderedBlock = {
      indexNum: 0,
      createdAt: new Date('2021-01-02T03:04:05.678Z'),
      tabs: [
        { url: 'https://example.com/a', title: 'title-a' },
        { url: 'https://example.com/b', title: 'title-b' },
      ],
      ...block,
    };
    await act(async () => {
      root = createRoot(container);
      root.render(<Block block={renderedBlock} updateBlock={updateBlock} />);
    });
  };

  const clickDelete = async (): Promise<void> => {
    await act(async () => {
      container.querySelector<HTMLElement>('.block-delete')!.click();
    });
  };

  beforeEach((): void => {
    container = document.createElement('div');
    document.body.appendChild(container);
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      i18n: {
        // 引数の確認ができるよう、キーと置換引数を連結して返す
        getMessage: (key: string, substitutions?: string[]): string =>
          substitutions == null ? key : `${key}:${substitutions.join('/')}`,
      },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    confirmSpy.mockRestore();
  });

  // リンクのままだとキーボードやスクリーンリーダーからボタンとして
  // 扱われず、他の操作リンクと区別も付かない
  test('カードの右上にボタンとして出す', async (): Promise<void> => {
    await mount(jest.fn().mockResolvedValue(undefined));

    const button = container.querySelector('.block-delete')!;
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    // アイコンだけでは何のボタンか分からないので名前を持たせる
    expect(button.getAttribute('aria-label')).toBe('content_msg_delete_block');
    // ロック・お気に入りと同じ右上の行にいる
    expect(
      container.querySelector('.block-card-header')!.contains(button),
    ).toBe(true);
  });

  test('確認してから削除する', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await clickDelete();

    // 何件失うのかは押す前に分からないとまずいので件数を出す
    expect(confirmSpy).toHaveBeenCalledWith(
      'content_msg_delete_block_confirm:2',
    );
    expect(savedBlock(updateBlock).tabs).toStrictEqual([]);
  });

  test('確認を取り消したら削除しない', async (): Promise<void> => {
    confirmSpy.mockReturnValue(false);
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock);

    await clickDelete();

    expect(updateBlock).not.toHaveBeenCalled();
  });

  // ロック中に削除できないのはリンクだったときと同じ
  test('ロック中は確認も出さず削除しない', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(updateBlock, { locked: true });

    await clickDelete();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(updateBlock).not.toHaveBeenCalled();
    const button = container.querySelector('.block-delete')!;
    // 淡色になるだけでは押せない理由が伝わらないためtitleで補う。
    // disabledにするとフォーカスできずtitleを読めない
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe(
      'content_msg_locked_action_disabled',
    );
  });

  // リンクを開いている最中にブロックごと消せる導線は元からあり、
  // 書き込みが打ち消し合わないことはApp側の直列化(#248)が担保する
  test('リンクを開いている最中でも押せる', async (): Promise<void> => {
    const createTabsSpy = jest
      .spyOn(chromeService.tab, 'createTabs')
      .mockReturnValue(new Promise<void>(() => undefined));

    try {
      const updateBlock = jest.fn().mockResolvedValue(undefined);
      await mount(updateBlock);

      await act(async () => {
        container.querySelectorAll<HTMLElement>('.tab_link')[0]!.click();
      });
      await clickDelete();

      expect(savedBlock(updateBlock).tabs).toStrictEqual([]);
    } finally {
      createTabsSpy.mockRestore();
    }
  });
});

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

    expect(updateBlock).toHaveBeenCalledWith(
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

    expect(updateBlock).toHaveBeenCalledWith(
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
    updateBlock: (newBlock: model.Block) => Promise<void>,
    locked?: boolean,
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
            locked: locked,
          }}
          updateBlock={updateBlock}
        />,
      );
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

  test('ロック中は「すべてのリンクを閉じる」と名前の編集を止める', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    await act(async () => {
      container.querySelector<HTMLElement>('.all_tab_delete')!.click();
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
        .querySelector<HTMLElement>('.all_tab_delete')!
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

    expect(updateBlock).toHaveBeenCalledWith({
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

    expect(updateBlock).toHaveBeenCalledWith(
      expect.objectContaining({ locked: undefined }),
    );
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

  test('ロックの状態をアイコンとaria-pressedで伝える', async (): Promise<void> => {
    const updateBlock = jest.fn().mockResolvedValue(undefined);
    await mount(
      [{ url: 'https://example.com/a', title: 'title-a' }],
      updateBlock,
      true,
    );

    const button =
      container.querySelector<HTMLButtonElement>('.block-lock-toggle')!;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('data-uk-icon')).toBe('icon: lock; ratio: 0.9');
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
});

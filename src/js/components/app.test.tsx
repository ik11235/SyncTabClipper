/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './app';
import { chromeService } from '../chromeService';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('App', (): void => {
  let localData: { [key: string]: string };
  let syncData: { [key: string]: string };
  let onChangedListeners: Array<
    (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => void
  >;
  let container: HTMLDivElement;
  let root: Root;
  let getAllBlockSpy: jest.SpyInstance;

  const mount = async (): Promise<void> => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
  };

  beforeEach((): void => {
    localData = {};
    syncData = {};
    onChangedListeners = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    getAllBlockSpy = jest.spyOn(chromeService.storage, 'getAllBlock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      runtime: {
        getManifest: () => ({ name: 'SyncTabClipper', version: '9.9.9' }),
      },
      i18n: {
        getMessage: (key: string): string => key,
      },
      storage: {
        local: {
          set: (obj: { [key: string]: string }): Promise<void> => {
            Object.assign(localData, obj);
            // 実際のChromeと同様に、変更をonChangedリスナーへ通知する
            for (const listener of onChangedListeners) {
              const changes: { [key: string]: chrome.storage.StorageChange } =
                {};
              for (const key of Object.keys(obj)) {
                changes[key] = { newValue: obj[key] };
              }
              listener(changes, 'local');
            }
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
        sync: {
          QUOTA_BYTES: 102400,
          getBytesInUse: (): Promise<number> => Promise.resolve(0),
          get: (keys: string[]): Promise<{ [key: string]: string }> => {
            const res: { [key: string]: string } = {};
            for (const key of keys) {
              const value = syncData[key];
              if (value != null) {
                res[key] = value;
              }
            }
            return Promise.resolve(res);
          },
        },
        onChanged: {
          addListener: (
            listener: (
              changes: { [key: string]: chrome.storage.StorageChange },
              areaName: string,
            ) => void,
          ): void => {
            onChangedListeners.push(listener);
          },
          removeListener: jest.fn(),
        },
      },
      action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
      },
    };
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    getAllBlockSpy.mockRestore();
  });

  test('ブロック読み込み成功時はタブの一覧を描画する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);

    await mount();

    expect(container.textContent).toContain('SyncTabClipper');
    expect(container.textContent).toContain('title-test');
    expect(container.textContent).toContain('content_msg_menu');
  });

  test('ブロックが空のときは未保存メッセージを表示する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([]);

    await mount();

    expect(container.textContent).toContain('content_msg_not_tab');
  });

  test('ブロック削除時はAppのstateが更新され一覧から消える', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);

    try {
      await mount();
      expect(container.textContent).toContain('title-test');

      const deleteLink = container.querySelector(
        '.all_tab_delete',
      ) as HTMLElement;
      await act(async () => {
        deleteLink.click();
      });

      // storageへ空タブのブロックとして永続化され、一覧からも消える
      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ indexNum: 0, tabs: [] }),
      );
      expect(container.textContent).not.toContain('title-test');
      expect(container.textContent).toContain('content_msg_not_tab');
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  // 2件のブロックを、お気に入りを付けると並びが入れ替わる形で用意する
  const twoBlocks = (): void => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-03T03:04:05.678Z'),
        title: 'title-new',
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        title: 'title-old',
        tabs: [{ url: 'https://example.com/b', title: 'tab-b' }],
      },
    ]);
  };

  /**
   * jsdomはレイアウトを持たないためoffsetTopが常に0になり、カードが動いても
   * 位置の差が出ない。カードが縦に100pxずつ並んでいるものとして、
   * 兄弟の中での順番から位置を作る（並び替えに追随する）
   * @return {jest.SpyInstance} 元に戻すためのspy
   */
  const stubCardLayout = (): jest.SpyInstance => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetTop',
    )!;
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement): number {
        const siblings = Array.from(this.parentElement?.children ?? []);
        return siblings.indexOf(this) * 100;
      },
    });
    // mockRestore相当の後片付けをspyと同じ形で返す
    return {
      mockRestore: (): void => {
        Object.defineProperty(HTMLElement.prototype, 'offsetTop', descriptor);
      },
    } as jest.SpyInstance;
  };

  // カードが瞬間移動すると、どこからどこへ動いたのか分からない。
  // 位置が変わったカードを元の位置から滑らせて見せる
  test('並び替えで位置が変わったカードを元の位置から滑らせる', async (): Promise<void> => {
    twoBlocks();
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const layoutStub = stubCardLayout();
    const animateSpy = jest
      .spyOn(Element.prototype, 'animate')
      .mockReturnValue({ cancel: (): void => {} } as Animation);

    try {
      await mount();
      // マウント時は比較対象がないので何も動かさない
      expect(animateSpy).not.toHaveBeenCalled();

      // 2枚目（title-old）をお気に入りにする。1枚目と入れ替わる
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
          .click();
      });

      // 動いた2枚がそれぞれ元の位置から滑る。
      // title-oldは100px下から、title-newは100px上から
      const moves = animateSpy.mock.calls.map(([keyframes, options]) => ({
        from: (keyframes as Keyframe[])[0]!.transform,
        to: (keyframes as Keyframe[])[1]!.transform,
        options: options,
      }));
      expect(moves).toEqual([
        {
          from: 'translateY(100px)',
          to: 'none',
          options: { duration: 500, easing: 'ease-in-out' },
        },
        {
          from: 'translateY(-100px)',
          to: 'none',
          options: { duration: 500, easing: 'ease-in-out' },
        },
      ]);
    } finally {
      animateSpy.mockRestore();
      layoutStub.mockRestore();
      setBlockSpy.mockRestore();
    }
  });

  // Blockは追随スクロールの行き先を決めるためにカードの位置を測る。
  // Mainが移動のtransformを載せた後で測ると、滑り出す前の位置（移動前の位置）を
  // 読んでしまい行き先を誤る。Block側をレイアウトeffectにして順序を保っている
  test('カードの位置はMainが移動のtransformを載せる前に測る', async (): Promise<void> => {
    twoBlocks();
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const layoutStub = stubCardLayout();
    const events: string[] = [];
    const scrollToSpy = jest
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {});
    const rectSpy = jest
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element): DOMRect {
        if (this.classList.contains('block-root-dom')) {
          events.push('measure');
        }
        // 画面外にあることにして、追随スクロールが実際に走る状況を作る
        return { top: 1000, bottom: 1200 } as DOMRect;
      });
    const animateSpy = jest
      .spyOn(Element.prototype, 'animate')
      .mockImplementation((): Animation => {
        events.push('animate');
        return { cancel: (): void => {} } as Animation;
      });

    try {
      await mount();
      events.length = 0;

      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
          .click();
      });

      expect(events).toContain('measure');
      expect(events).toContain('animate');
      expect(events.indexOf('animate')).toBeGreaterThan(
        events.indexOf('measure'),
      );
    } finally {
      animateSpy.mockRestore();
      rectSpy.mockRestore();
      scrollToSpy.mockRestore();
      layoutStub.mockRestore();
      setBlockSpy.mockRestore();
    }
  });

  // 先頭のブロックをお気に入りにしても並びは変わらない。
  // 位置が変わっていないカードを動かすと、その場で無駄に揺れる
  test('位置が変わらなければカードを滑らせない', async (): Promise<void> => {
    twoBlocks();
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const layoutStub = stubCardLayout();
    const animateSpy = jest
      .spyOn(Element.prototype, 'animate')
      .mockReturnValue({ cancel: (): void => {} } as Animation);

    try {
      await mount();

      // すでに先頭にいる1枚目（title-new）をお気に入りにする
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[0]!
          .click();
      });

      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ indexNum: 0, starred: true }),
      );
      expect(
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        ),
      ).toEqual(['title-new', 'title-old']);
      expect(animateSpy).not.toHaveBeenCalled();
    } finally {
      animateSpy.mockRestore();
      layoutStub.mockRestore();
      setBlockSpy.mockRestore();
    }
  });

  // アニメーションを控える設定のときは瞬間移動のままにする
  test('アニメーションを控える設定ならカードを滑らせない', async (): Promise<void> => {
    twoBlocks();
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const layoutStub = stubCardLayout();
    const animateSpy = jest
      .spyOn(Element.prototype, 'animate')
      .mockReturnValue({ cancel: (): void => {} } as Animation);
    const matchMediaSpy = jest
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);

    try {
      await mount();
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
          .click();
      });

      // 並びは変わるが、滑らせはしない
      expect(
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        ),
      ).toEqual(['title-old', 'title-new']);
      expect(animateSpy).not.toHaveBeenCalled();
    } finally {
      matchMediaSpy.mockRestore();
      animateSpy.mockRestore();
      layoutStub.mockRestore();
      setBlockSpy.mockRestore();
    }
  });

  // storageから読み込んだ並びを固定したままだと、お気に入りにしたブロックが
  // リロードするまで先頭に来ない
  test('お気に入りにしたブロックはその場で一覧の先頭へ移る', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-03T03:04:05.678Z'),
        title: 'title-new',
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        title: 'title-old',
        tabs: [{ url: 'https://example.com/b', title: 'tab-b' }],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);

    try {
      await mount();

      const blockTitles = (): (string | null)[] =>
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        );
      // 作成日の降順。お気に入りを付ける前は新しいブロックが先頭
      expect(blockTitles()).toEqual(['title-new', 'title-old']);

      // 古いブロック（2枚目）をお気に入りにする
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
          .click();
      });

      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ indexNum: 1, starred: true }),
      );
      expect(blockTitles()).toEqual(['title-old', 'title-new']);
      // リボンは先頭に移ったブロックにだけ出る。件数だけでは
      // 2枚目に出ていても通ってしまうため、位置まで見る
      const cards = container.querySelectorAll('.block-root-dom');
      expect(cards[0]!.querySelector('.block-star-ribbon')).not.toBeNull();
      expect(cards[1]!.querySelector('.block-star-ribbon')).toBeNull();

      // 解除すると作成日順の位置へ戻る
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[0]!
          .click();
      });

      expect(blockTitles()).toEqual(['title-new', 'title-old']);
      expect(container.querySelector('.block-star-ribbon')).toBeNull();
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  // 押したカードは並び替えで一覧内を移動するため、追わないと画面外へ消える。
  // 追随を書き込みのPromiseの中で行うと、Reactが並び替えをコミットする前に
  // 走って何も起きない。「並び替え後のDOMを見て呼ばれているか」まで見る
  test('お気に入りの並び替えが済んだ後にカードを画面内に追う', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-03T03:04:05.678Z'),
        title: 'title-new',
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        title: 'title-old',
        tabs: [{ url: 'https://example.com/b', title: 'tab-b' }],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    // 追随の可否と量はカードの位置を測って決める。その測定はeffectの中で
    // 同期的に行われるため、測った瞬間の並びを見れば「並び替えのコミット後に
    // 走っているか」が分かる
    const callsAtScroll: { titles: (string | null)[]; isTarget: boolean }[] =
      [];
    const scrollToSpy = jest
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {});
    const rectSpy = jest
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element): DOMRect {
        if (this.classList.contains('block-root-dom')) {
          callsAtScroll.push({
            titles: Array.from(container.querySelectorAll('.block-title')).map(
              (e) => e.textContent,
            ),
            isTarget: this === container.querySelector('.block-root-dom'),
          });
        }
        // 画面外にあることにして、追随が実際に走る状況を作る
        return { top: 1000, bottom: 1200 } as DOMRect;
      });

    try {
      await mount();

      // act()の外でクリックする。act()は状態更新を同期的にフラッシュするため、
      // 「書き込みのPromise内で追う」誤った実装でも並び替え後のDOMが見えてしまい、
      // 本番の順序（並び替えのコミットはスケジューラ経由で後になる）を再現できない
      const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
      const previousActEnv = actEnv.IS_REACT_ACT_ENVIRONMENT;
      actEnv.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        // 2枚目（古いブロック）をマウスでお気に入りにする
        // （HTMLElement.click()はdetailが0でキーボード起動と区別できない）
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        // 書き込み→state更新→並び替えのコミット→effectまで進むのを待つ
        for (let i = 0; i < 50 && callsAtScroll.length <= 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        // 待機を抜けた後に2回目が来ないことも見る（追随は1回だけ）
        for (let i = 0; i < 5; i++) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        actEnv.IS_REACT_ACT_ENVIRONMENT = previousActEnv;
      }

      expect(callsAtScroll).toHaveLength(1);
      // 並び替えが済んだ後の並びを見て測っている
      expect(callsAtScroll[0]!.titles).toEqual(['title-old', 'title-new']);
      // 追いかけたのは移動して先頭に来た当該カード
      expect(callsAtScroll[0]!.isTarget).toBe(true);
    } finally {
      rectSpy.mockRestore();
      scrollToSpy.mockRestore();
      setBlockSpy.mockRestore();
    }
  });

  test('あるブロックの更新時に他のブロックは再レンダリングされない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        // 一覧は作成日の降順に並ぶため、先頭に来るブロックAを新しくしておく
        indexNum: 0,
        createdAt: new Date('2021-01-03T03:04:05.678Z'),
        tabs: [
          { url: 'https://example.com/a1', title: 'title-a1' },
          { url: 'https://example.com/a2', title: 'title-a2' },
        ],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        // ブロックAの更新後のタブ数(1)と重ならない数にして、
        // どちらのブロックのレンダリングかを引数で見分けられるようにする
        tabs: [
          { url: 'https://example.com/b1', title: 'title-b1' },
          { url: 'https://example.com/b2', title: 'title-b2' },
          { url: 'https://example.com/b3', title: 'title-b3' },
        ],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    // Blockはレンダリングのたびにcontent_msg_tab_countをタブ数付きで
    // 必ず1回取得するため、その呼び出しを再レンダリングの代理指標として使う。
    // 更新したブロック自体は書き込みの状態遷移で複数回レンダリングされるので、
    // 回数の合計ではなく「ブロックBのタブ数で呼ばれたか」で判定する
    // （content_msg_tab_lengthは名前のないブロックの見出しにしか出ないので使えない）
    // どちらのブロックのレンダリングか見分けるためsubstitutionsも記録する
    const getMessageSpy = jest.fn(
      (...args: [key: string, substitutions?: unknown]): string => args[0],
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome.i18n.getMessage = getMessageSpy;

    try {
      await mount();
      getMessageSpy.mockClear();

      // 先頭ブロック（ブロックA）のタブを1件削除する
      const tabCloseLink = container.querySelector('.tab_close') as HTMLElement;
      await act(async () => {
        tabCloseLink.click();
      });

      expect(container.textContent).not.toContain('title-a1');
      expect(container.textContent).toContain('title-a2');
      expect(container.textContent).toContain('title-b1');
      // 再レンダリングされたブロックのタブ数の並び。
      // ブロックAは書き込みの状態遷移で複数回レンダリングされるので回数は
      // 固定できないが、ブロックBのタブ数(3)が現れないことは固定できる
      const renderedTabCounts = getMessageSpy.mock.calls
        .filter(([key]) => key === 'content_msg_tab_count')
        .map(([, substitutions]) =>
          Array.isArray(substitutions) ? substitutions[0] : null,
        );
      // 更新したブロックA（削除後は1タブ）だけが再レンダリングされている
      expect(renderedTabCounts).not.toHaveLength(0);
      expect(new Set(renderedTabCounts)).toEqual(new Set([1]));
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  test('全データ削除時はAppのstateが空になり未保存メッセージを表示する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);
    const allClearSpy = jest
      .spyOn(chromeService.storage, 'allClear')
      .mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = jest
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);

    try {
      await mount();
      expect(container.textContent).toContain('title-test');

      const allClearLink = container.querySelector('#all_clear') as HTMLElement;
      await act(async () => {
        allClearLink.click();
      });

      // storageが全削除され、一覧も空表示に切り替わる
      expect(allClearSpy).toHaveBeenCalled();
      expect(container.textContent).not.toContain('title-test');
      expect(container.textContent).toContain('content_msg_not_tab');
    } finally {
      allClearSpy.mockRestore();
      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    }
  });

  test('ブロック読み込み失敗時もエラー表示は機能する', async (): Promise<void> => {
    getAllBlockSpy.mockRejectedValue(new Error('load failed'));

    await mount();

    expect(container.textContent).toContain('load failed');
    // ヘッダーとサイドバーは読み込み失敗と無関係に描画される
    expect(container.textContent).toContain('SyncTabClipper');
    expect(container.textContent).toContain('content_msg_menu');
  });

  // 壊れたデータ1件で一覧全体が表示されなくなる不具合(#192)の回帰テスト
  test('レンダリングで落ちるブロックがあっても他のブロックは表示される', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        // createdAtが不正なDateだとblock.tsxのtoISOString()がRangeErrorを投げる
        createdAt: new Date('invalid'),
        tabs: [{ url: 'https://example.com/broken', title: 'title-broken' }],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/valid', title: 'title-valid' }],
      },
    ]);
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      // 落ちたブロックは削除できるカードに差し替わり、他のブロックは残る
      expect(container.textContent).toContain('content_msg_broken_block');
      expect(container.textContent).not.toContain('title-broken');
      expect(container.textContent).toContain('title-valid');
      expect(container.textContent).not.toContain('content_msg_not_tab');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  // 描画に失敗したロック済みブロックはロックを解除する導線ごと失われるため、
  // 差し替わったカードの削除ボタンが保護を素通りしないようにする(#194)
  test('ロックしたブロックがレンダリングで落ちたら削除前に警告する', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        // createdAtが不正なDateだとblock.tsxのtoISOString()がRangeErrorを投げる
        createdAt: new Date('invalid'),
        tabs: [{ url: 'https://example.com/locked', title: 'title-locked' }],
        locked: true,
      },
    ]);
    const removeBlockSpy = jest
      .spyOn(chromeService.storage, 'removeBlock')
      .mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      const deleteLink = container.querySelector(
        '.broken_block_delete',
      ) as HTMLElement;
      await act(async () => {
        deleteLink.click();
      });

      expect(confirmSpy).toHaveBeenCalledWith(
        'content_msg_locked_block_delete_confirm',
      );
      expect(removeBlockSpy).not.toHaveBeenCalled();

      // 警告を承諾したときだけ削除する
      confirmSpy.mockReturnValue(true);
      await act(async () => {
        deleteLink.click();
      });

      expect(removeBlockSpy).toHaveBeenCalledWith(0);
    } finally {
      consoleErrorSpy.mockRestore();
      confirmSpy.mockRestore();
      removeBlockSpy.mockRestore();
    }
  });

  test('復元できなかったブロックはカードとして表示され削除できる', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/valid', title: 'title-valid' }],
      },
      { indexNum: 1, broken: true, unsupported: false },
    ]);
    const removeBlockSpy = jest
      .spyOn(chromeService.storage, 'removeBlock')
      .mockResolvedValue(undefined);

    try {
      await mount();
      expect(container.textContent).toContain('content_msg_broken_block');
      expect(container.textContent).toContain('title-valid');

      const deleteLink = container.querySelector(
        '.broken_block_delete',
      ) as HTMLElement;
      await act(async () => {
        deleteLink.click();
      });

      // indexNumだけでstorageから削除され、一覧からも消える
      expect(removeBlockSpy).toHaveBeenCalledWith(1);
      expect(container.textContent).not.toContain('content_msg_broken_block');
      expect(container.textContent).toContain('title-valid');
    } finally {
      removeBlockSpy.mockRestore();
    }
  });

  // getAllBlockをモックせず実際のstorage経由で検証する。
  // モックした一覧を渡すテストだけでは、実データから到達しうる壊れ方を
  // 取りこぼす（#192がnode環境のテストで2年隠れたのと同型のリスク）
  test('実データが壊れていても壊れた要素だけがカードになる', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '3';
    // タブ要素がnullだとtab.tsxがレンダリング時に例外を投げる
    syncData['td_0'] =
      '{"v":2,"created_at":1609556645678,"tabs":[null,{"url":"https://example.com/x","title":"title-x"}]}';
    // JSONとして壊れており復元自体ができない
    syncData['td_1'] = '{"v":2,"created_at":1';
    syncData['td_2'] =
      '{"v":2,"created_at":1640000000000,"tabs":[{"url":"https://example.com/ok","title":"title-ok"}]}';
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      // 壊れたタブ1件はブロック全体を巻き込まず、同じブロックの正常なタブは残る
      expect(container.textContent).toContain('title-x');
      expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(1);
      // 復元できなかったブロックだけがカードになる
      expect(container.textContent).toContain('title-ok');
      expect(container.querySelectorAll('.broken_block_delete')).toHaveLength(
        1,
      );
      expect(container.textContent).not.toContain('content_msg_not_tab');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test('壊れたタブを削除しても同じブロックの正常なタブは残る', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '1';
    syncData['td_0'] =
      '{"v":2,"created_at":1609556645678,"tabs":[null,{"url":"https://example.com/x","title":"title-x"}]}';
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      const closeLink = container.querySelector(
        '.broken_tab_close',
      ) as HTMLElement;
      await act(async () => {
        closeLink.click();
      });

      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indexNum: 0,
          tabs: [{ url: 'https://example.com/x', title: 'title-x' }],
        }),
      );
      expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(0);
      expect(container.textContent).toContain('title-x');
    } finally {
      setBlockSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // 欠けたバックアップを完全なものと誤解して全データ削除に進むのを防ぐ。
  // エクスポート自体は成功しているため、errorLog（赤バッジ+アラート）ではなく
  // ユーザー操作への応答としてその場で伝える
  test('復元できなかったブロックがあるとエクスポート時に欠損を伝える', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '2';
    syncData['td_0'] = '{"v":2,"created_at":1';
    syncData['td_1'] =
      '{"v":2,"created_at":1640000000000,"tabs":[{"url":"https://example.com/ok","title":"title-ok"}]}';
    const alertSpy = jest
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      const exportLink = container.querySelector('#export_link') as HTMLElement;
      await act(async () => {
        exportLink.click();
      });

      expect(alertSpy).toHaveBeenCalledWith('content_msg_export_broken_block');
      // 読めたブロックはエクスポートされ、赤バッジのエラー通知は立てない
      const exportBody = container.querySelector(
        '#export_body',
      ) as HTMLTextAreaElement;
      expect(exportBody.value).toContain('title-ok');
      expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    } finally {
      alertSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // 新しいバージョンで保存されただけのデータは実データが生きている可能性があり、
  // 削除するとすべての同期端末から消える。ただし削除自体を塞ぐと
  // 「すべてのデータを削除」以外に消す手段がなくなるため、警告して委ねる
  test('未対応バージョンのブロックは警告に同意しないと削除されない', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '1';
    syncData['td_0'] =
      '{"v":99,"created_at":1609556645678,"tabs":[{"url":"https://example.com/v3","title":"title-v3"}]}';
    const removeBlockSpy = jest
      .spyOn(chromeService.storage, 'removeBlock')
      .mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();
      expect(container.textContent).toContain('content_msg_unsupported_block');

      const deleteLink = container.querySelector(
        '.broken_block_delete',
      ) as HTMLElement;
      await act(async () => {
        deleteLink.click();
      });

      // 同意しなければ削除されない
      expect(confirmSpy).toHaveBeenCalledWith(
        'content_msg_unsupported_block_delete_confirm',
      );
      expect(removeBlockSpy).not.toHaveBeenCalled();
      expect(container.textContent).toContain('content_msg_unsupported_block');

      // 同意すれば削除できる（袋小路にしない）
      confirmSpy.mockReturnValue(true);
      await act(async () => {
        deleteLink.click();
      });
      expect(removeBlockSpy).toHaveBeenCalledWith(0);
      expect(container.textContent).toContain('content_msg_not_tab');
    } finally {
      removeBlockSpy.mockRestore();
      confirmSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // 壊れたブロックの削除には確認を挟まない（実データが読めないため）
  test('壊れたブロックの削除には確認を求めない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      { indexNum: 0, broken: true, unsupported: false },
    ]);
    const removeBlockSpy = jest
      .spyOn(chromeService.storage, 'removeBlock')
      .mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    try {
      await mount();
      const deleteLink = container.querySelector(
        '.broken_block_delete',
      ) as HTMLElement;
      await act(async () => {
        deleteLink.click();
      });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(removeBlockSpy).toHaveBeenCalledWith(0);
    } finally {
      removeBlockSpy.mockRestore();
      confirmSpy.mockRestore();
    }
  });

  // 境界を下げた結果、壊れたタブを含むブロックでも「すべてのリンクを開く」が
  // 押せるようになった。mapの途中で例外になると残りのタブが開かれないまま
  // イベントハンドラの外へ抜け、通知もされない
  test('壊れたタブがあってもすべてのリンクを開くは正常なタブを全部開く', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '1';
    syncData['td_0'] =
      '{"v":2,"created_at":1609556645678,"tabs":[{"url":"https://example.com/a","title":"a"},null,{"url":"https://example.com/b","title":"b"}]}';
    const createTabsSpy = jest
      .spyOn(chromeService.tab, 'createTabs')
      .mockResolvedValue(undefined);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      const openAllLink = container.querySelector(
        '.all_tab_link',
      ) as HTMLElement;
      await act(async () => {
        openAllLink.click();
      });

      expect(createTabsSpy).toHaveBeenCalledTimes(2);
      expect(createTabsSpy).toHaveBeenCalledWith({
        url: 'https://example.com/a',
        active: false,
      });
      expect(createTabsSpy).toHaveBeenCalledWith({
        url: 'https://example.com/b',
        active: false,
      });
      // 開いたタブだけが消え、開けなかったタブは残る
      // （ブロックごと消すと、一覧に見えていたタブが開かれもせず失われる）
      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ indexNum: 0, tabs: [null] }),
      );
    } finally {
      createTabsSpy.mockRestore();
      setBlockSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // urlを持たないタブはリンクとして機能せず、クリックすると空の新規タブが
  // 開いて元のデータが消えるため、壊れたタブとして扱う
  test('urlを持たないタブは壊れたタブとして表示し個別に削除できる', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '1';
    // tab自体がnullのタブと、urlを持たないタブが共存する
    syncData['td_0'] =
      '{"v":2,"created_at":1609556645678,"tabs":[null,{"title":"title-no-url"},{"url":"https://example.com/ok","title":"title-ok"}]}';
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();
      // urlのないタブはリンクとして描画されない
      expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(2);
      expect(container.textContent).not.toContain('title-no-url');
      expect(container.textContent).toContain('title-ok');

      const closeLink = container.querySelector(
        '.broken_tab_close',
      ) as HTMLElement;
      await act(async () => {
        closeLink.click();
      });

      // 先頭の壊れたタブだけが消え、残りは巻き添えにならない
      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indexNum: 0,
          tabs: [
            { title: 'title-no-url' },
            { url: 'https://example.com/ok', title: 'title-ok' },
          ],
        }),
      );
      expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(1);
      expect(container.textContent).toContain('title-ok');
    } finally {
      setBlockSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // 開くものがないのに書き戻すと、storage.syncの書き込みクォータを
  // 無駄に消費するだけで一覧も変わらない
  test('開けるタブが1件もないブロックではすべてのリンクを開くが何もしない', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '1';
    syncData['td_0'] =
      '{"v":2,"created_at":1609556645678,"tabs":[null,{"url":"","title":"title-empty"}]}';
    const createTabsSpy = jest
      .spyOn(chromeService.tab, 'createTabs')
      .mockResolvedValue(undefined);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      const openAllLink = container.querySelector(
        '.all_tab_link',
      ) as HTMLElement;
      await act(async () => {
        openAllLink.click();
      });

      expect(createTabsSpy).not.toHaveBeenCalled();
      expect(setBlockSpy).not.toHaveBeenCalled();
      expect(container.textContent).toContain('title-empty');
    } finally {
      createTabsSpy.mockRestore();
      setBlockSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // urlが空文字列のタブ(#192で特定したchrome.tabs.Tab.urlの挙動)は
  // titleが読めるので通常のタブとして表示し、開けないので開くときだけ除く
  test('urlが空文字列のタブは表示されるが、すべてのリンクを開くでは開かず残る', async (): Promise<void> => {
    getAllBlockSpy.mockRestore();
    syncData['t_len'] = '1';
    syncData['td_0'] =
      '{"v":2,"created_at":1609556645678,"tabs":[{"url":"","title":"title-empty"},{"url":"https://example.com/ok","title":"title-ok"}]}';
    const createTabsSpy = jest
      .spyOn(chromeService.tab, 'createTabs')
      .mockResolvedValue(undefined);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);

    try {
      await mount();
      expect(container.textContent).toContain('title-empty');
      expect(container.querySelectorAll('.broken_tab_close')).toHaveLength(0);

      const openAllLink = container.querySelector(
        '.all_tab_link',
      ) as HTMLElement;
      await act(async () => {
        openAllLink.click();
      });

      // 空urlはchrome.tabs.createに渡さず、開けなかったタブとして残す
      expect(createTabsSpy).toHaveBeenCalledTimes(1);
      expect(createTabsSpy).toHaveBeenCalledWith({
        url: 'https://example.com/ok',
        active: false,
      });
      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indexNum: 0,
          tabs: [{ url: '', title: 'title-empty' }],
        }),
      );
    } finally {
      createTabsSpy.mockRestore();
      setBlockSpy.mockRestore();
    }
  });

  test('タブの編集内容がstorageへ永続化され一覧の表示も更新される', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [
          { url: 'https://example.com/a', title: 'title-a' },
          { url: 'https://example.com/b', title: 'title-b' },
        ],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);

    try {
      await mount();

      // 2件目のタブを編集する
      const editIcon = container.querySelectorAll<HTMLElement>('.tab_edit')[1]!;
      await act(async () => {
        editIcon.click();
      });

      const titleInput =
        container.querySelector<HTMLInputElement>('.edit-tab-title')!;
      expect(titleInput.value).toBe('title-b');
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      await act(async () => {
        setter.call(titleInput, 'renamed-b');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('.edit-tab-save')!.click();
      });

      // 編集したタブだけが差し替わって永続化される
      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indexNum: 0,
          tabs: [
            { url: 'https://example.com/a', title: 'title-a' },
            { url: 'https://example.com/b', title: 'renamed-b' },
          ],
        }),
      );
      // 保存できたのでモーダルは閉じ、一覧の表示も新しい名前になる
      expect(container.querySelector('.edit-tab-modal')).toBeNull();
      expect(container.textContent).toContain('renamed-b');
      expect(container.textContent).not.toContain('title-b');
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  // 保存に失敗した入力が消えると、書き直しをやり直す羽目になる
  test('タブの編集が保存に失敗したらモーダルを閉じず一覧も変えない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/a', title: 'title-a' }],
      },
    ]);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

    try {
      await mount();

      await act(async () => {
        container.querySelector<HTMLElement>('.tab_edit')!.click();
      });
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

      // errorLogへの記録は保存の失敗を待たずに走るため、書き込みの完了を待つ
      await act(async () => {});

      // 入力を保持したまま開いたままにし、失敗はerrorLog経由で通知する
      expect(container.querySelector('.edit-tab-modal')).not.toBeNull();
      expect(
        container.querySelector<HTMLInputElement>('.edit-tab-title')!.value,
      ).toBe('renamed-a');
      expect(container.textContent).toContain('title-a');
      // errorLogに流れたエラーはErrorDisplayがアラートとして表示する
      // （表示時に確認済みとしてstorageからは消える）
      expect(
        container.querySelector('.uk-alert-danger')!.textContent,
      ).toContain('QUOTA_BYTES_PER_ITEM');
    } finally {
      setBlockSpy.mockRestore();
    }
  });

  test('ブロックのレンダリング時例外でもページ全体は生き残る', async (): Promise<void> => {
    // createdAtが不正なDateだとblock.tsxのtoISOString()がRangeErrorを投げる
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('invalid'),
        tabs: [{ url: 'https://example.com/test', title: 'title-test' }],
      },
    ]);
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await mount();

      // ヘッダー・サイドバーはアンマウントされず、落ちたブロックはカードになる
      expect(container.textContent).toContain('SyncTabClipper');
      expect(container.textContent).toContain('content_msg_menu');
      expect(container.textContent).toContain('content_msg_broken_block');
      // カード自体が表示になるため、生の例外メッセージはアラートに出さない
      expect(container.textContent).not.toContain('Invalid time value');
      expect(localData[chromeService.errorLog.errorKey]).toBeUndefined();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

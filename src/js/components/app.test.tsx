/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './app';
import { chromeService } from '../chromeService';
import { model } from '../types/interface';

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

  // storage.syncの変更をChromeと同様に購読側へ通知する
  const notifySync = (changes: {
    [key: string]: chrome.storage.StorageChange;
  }): void => {
    for (const listener of onChangedListeners) {
      listener(changes, 'sync');
    }
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

  // テスト内でカード1枚の高さとして扱う値
  const CARD_HEIGHT = 100;

  /**
   * jsdomはレイアウトを持たないためoffsetTopが常に0になり、カードが動いても
   * 位置の差が出ない。カードが縦にCARD_HEIGHTずつ並んでいるものとして、
   * 兄弟の中での順番から位置を作る（並び替えに追随する）
   * @return {jest.SpyInstance} 元に戻すためのspy
   */
  const stubCardLayout = (): jest.SpyInstance => {
    const topDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetTop',
    )!;
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight',
    )!;
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement): number {
        const siblings = Array.from(this.parentElement?.children ?? []);
        return siblings.indexOf(this) * CARD_HEIGHT;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: (): number => CARD_HEIGHT,
    });
    // mockRestore相当の後片付けをspyと同じ形で返す
    return {
      mockRestore: (): void => {
        Object.defineProperty(
          HTMLElement.prototype,
          'offsetTop',
          topDescriptor,
        );
        Object.defineProperty(
          HTMLElement.prototype,
          'offsetHeight',
          heightDescriptor,
        );
      },
    } as jest.SpyInstance;
  };

  /**
   * ウィンドウをスクロールできる状態にする。jsdomはレイアウトを持たないため
   * scrollYもscrollHeightも0で、スクロールできる範囲が存在しない
   * @param {number} initialScrollY 最初のスクロール位置
   * @return {object} 指示されたスクロール位置の記録と、後片付けする関数
   */
  const stubScrollableWindow = (
    initialScrollY: number,
  ): {
    tops: number[];
    setScrollY: (value: number) => void;
    restore: () => void;
  } => {
    let scrollY = initialScrollY;
    const tops: number[] = [];
    // scrollYはjsdomでは値プロパティなのでspyOnのgetterでは差し替えられない
    const scrollYDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'scrollY',
    );
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: (): number => scrollY,
    });
    // scrollHeightはElement.prototypeのgetterなので、要素側に直接生やす
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: (): number => 5000,
    });
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(((
      options: ScrollToOptions,
    ): void => {
      scrollY = options.top!;
      tops.push(scrollY);
    }) as typeof window.scrollTo);
    return {
      tops: tops,
      // ブラウザがスクロール位置を勝手に動かす状況（スクロールアンカリング）を作る
      setScrollY: (value: number): void => {
        scrollY = value;
      },
      restore: (): void => {
        scrollToSpy.mockRestore();
        delete (document.documentElement as unknown as Record<string, unknown>)
          .scrollHeight;
        if (scrollYDescriptor != null) {
          Object.defineProperty(window, 'scrollY', scrollYDescriptor);
        }
      },
    };
  };

  /**
   * 並び替えの見せ方を確かめるための下準備。jsdomはレイアウトを持たないため、
   * カードの位置・画面の高さ・スクロール位置をすべて自分で与える必要がある。
   * 時間の進み方もこちらで握る（アニメーションはrequestAnimationFrameで動く）
   * @param {number} initialScrollY 最初のスクロール位置
   * @return {object} スクロールの記録・setBlockのspy・後片付けする関数
   */
  const stubMoveAnimation = (
    initialScrollY: number,
  ): {
    scroll: ReturnType<typeof stubScrollableWindow>;
    setBlockSpy: jest.SpyInstance;
    restore: () => void;
  } => {
    const layoutStub = stubCardLayout();
    const scroll = stubScrollableWindow(initialScrollY);
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    jest.useFakeTimers();
    return {
      scroll: scroll,
      setBlockSpy: setBlockSpy,
      restore: (): void => {
        jest.useRealTimers();
        scroll.restore();
        layoutStub.mockRestore();
        setBlockSpy.mockRestore();
      },
    };
  };

  /**
   * カードのtransformを現在の一覧の順に並べて返す
   * @return {string[]} 各カードのtransform（付いていなければ空文字列）
   */
  const cardTransforms = (): string[] =>
    Array.from(container.querySelectorAll<HTMLElement>('.block-root-dom')).map(
      (card) => card.style.transform,
    );

  /**
   * 2枚目のブロックをマウスでお気に入りにする。1枚目と入れ替わる
   * （HTMLElement.click()はdetailが0でキーボード起動と区別できない）
   * @return {Promise<void>} 反映を待つPromise
   */
  const starSecondBlock = async (): Promise<void> => {
    await act(async () => {
      container
        .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
  };

  // カードが瞬間移動すると、どこからどこへ動いたのか分からない。
  // 位置が変わったカードを元の位置から滑らせて見せる
  test('並び替えで位置が変わったカードを元の位置から滑らせる', async (): Promise<void> => {
    twoBlocks();
    const { restore } = stubMoveAnimation(500);

    try {
      await mount();
      // マウント時は比較対象がないので何も動かさない
      expect(cardTransforms()).toEqual(['', '']);

      await starSecondBlock();

      // 動き始めはそれぞれ元の位置。お気に入りにしたカードは100px下から、
      // 押しのけられたカードは100px上から始まる（DOMの順は入れ替わっている）
      expect(cardTransforms()).toEqual([
        'translateY(100px)',
        'translateY(-100px)',
      ]);

      // 画面を動かしている間（300ms）はカードを元の位置に留めておく。
      // 先に動かしてしまうと、画面が着く前に移動が終わってしまう
      jest.advanceTimersByTime(250);
      expect(cardTransforms()).toEqual([
        'translateY(100px)',
        'translateY(-100px)',
      ]);

      // 画面が着いてから滑り出し、途中では元の位置と新しい位置の間にいる
      jest.advanceTimersByTime(320);
      const midway = cardTransforms();
      expect(midway[0]).not.toBe('translateY(100px)');
      expect(midway[0]).not.toBe('');

      // 滑り終わるとインラインスタイルも残さない
      jest.advanceTimersByTime(1000);
      expect(cardTransforms()).toEqual(['', '']);
    } finally {
      restore();
    }
  });

  // カードと同じだけ画面を動かす（追いかける）と、カードは画面内の同じ場所に
  // 留まってしまい移動していないように見える。先に画面を移動先へ動かし、
  // そこへカードを滑らせてくる
  test('先に画面が移動先へ動き、その後カードが滑ってくる', async (): Promise<void> => {
    twoBlocks();
    const { scroll, restore } = stubMoveAnimation(500);

    try {
      await mount();
      expect(scroll.tops).toEqual([]);

      await starSecondBlock();

      // 動き出しは押した時点のスクロール位置。ここが移動先になっていると
      // 「着いた先から始まる」ため移動が見えない
      expect(scroll.tops[0]).toBe(500);

      // 移動先（先頭・レイアウト上の位置0）が画面の中央に来るよう動かす。
      // 画面の中央に置けない（上端に届く）ため上端で止まる。
      // requestAnimationFrameは16ms刻みなので、境界をまたぐ分だけ余分に進める
      jest.advanceTimersByTime(320);
      expect(scroll.tops[scroll.tops.length - 1]).toBe(0);
      // 一気に飛ばず、途中の位置を通る
      expect(scroll.tops.length).toBeGreaterThan(2);
      for (const top of scroll.tops) {
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThanOrEqual(500);
      }

      // カードが滑っている間は画面を動かさない
      const scrollCalls = scroll.tops.length;
      jest.advanceTimersByTime(1000);
      expect(scroll.tops.length).toBe(scrollCalls);
      expect(cardTransforms()).toEqual(['', '']);
    } finally {
      restore();
    }
  });

  // 他にお気に入りがある状態で付けると、カードは先頭ではなく途中へ動く。
  // 画面がカードを追いかけていた頃はこの場合にカードが静止して見えていた
  test('途中の位置へ動く場合も画面が移動先を見せてから滑ってくる', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-04T03:04:05.678Z'),
        title: 'title-new',
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
      {
        indexNum: 1,
        createdAt: new Date('2021-01-03T03:04:05.678Z'),
        title: 'title-starred',
        starred: true,
        tabs: [{ url: 'https://example.com/b', title: 'tab-b' }],
      },
      {
        indexNum: 2,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        title: 'title-old',
        tabs: [{ url: 'https://example.com/c', title: 'tab-c' }],
      },
    ]);
    const { scroll, restore } = stubMoveAnimation(1000);

    try {
      await mount();
      const blockTitles = (): (string | null)[] =>
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        );
      // お気に入りが先頭、その後ろが作成日の降順
      expect(blockTitles()).toEqual([
        'title-starred',
        'title-new',
        'title-old',
      ]);

      // 一番下（title-old）をお気に入りにする。先頭ではなく2枚目へ動く
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[2]!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      });

      expect(blockTitles()).toEqual([
        'title-starred',
        'title-old',
        'title-new',
      ]);
      // 移動先は2枚目（レイアウト上の位置100）。画面の中央には置けないので
      // 上端で止まるが、移動先が画面に入る位置まで動く
      jest.advanceTimersByTime(320);
      expect(scroll.tops[0]).toBe(1000);
      expect(scroll.tops[scroll.tops.length - 1]).toBe(0);

      // 画面が着いてからカードが滑る。滑っている間に画面は動かない
      const scrollCalls = scroll.tops.length;
      jest.advanceTimersByTime(1000);
      expect(cardTransforms()).toEqual(['', '', '']);
      expect(scroll.tops.length).toBe(scrollCalls);
    } finally {
      restore();
    }
  });

  // 移動先がすでに画面に入っているなら、画面を動かす必要がない。
  // 動かすと見ている位置が理由もなくずれる。
  // お気に入りが4件あるので、5枚目の移動先は上から400px（画面内だが、
  // 中央に寄せようとすると画面が動いてしまう位置）になる
  test('移動先が画面に入っているなら画面を動かさない', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue(
      [0, 1, 2, 3, 4, 5].map((i) => ({
        indexNum: i,
        // 添字が小さいほど新しい。お気に入り同士も作成日の降順に並ぶ
        createdAt: new Date(Date.UTC(2021, 0, 10 - i)),
        title: `title-${i}`,
        ...(i <= 3 ? { starred: true } : {}),
        tabs: [{ url: `https://example.com/${i}`, title: `tab-${i}` }],
      })),
    );
    // スクロール位置0なら、移動先(400〜500)は画面(0〜768)に収まっている
    const { scroll, restore } = stubMoveAnimation(0);

    try {
      await mount();
      const blockTitles = (): (string | null)[] =>
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        );
      expect(blockTitles()).toEqual([
        'title-0',
        'title-1',
        'title-2',
        'title-3',
        'title-4',
        'title-5',
      ]);

      // 一番下（6枚目）をお気に入りにすると、5枚目の位置へ動く
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[5]!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      });
      expect(blockTitles()[4]).toBe('title-5');

      // 画面は動かさず、カードだけが滑る
      jest.advanceTimersByTime(1000);
      expect(cardTransforms()[4]).toBe('');
      expect(scroll.tops).toEqual([0]);
    } finally {
      restore();
    }
  });

  // カードが移動すると、ブラウザのスクロールアンカリングが見えている内容を
  // 保とうとしてスクロール位置を勝手に補正する。追従の起点にその補正後の値を
  // 使うと、押したときに見えていた景色から始まらない（＝移動が見えない）ため、
  // 押した時点の位置を覚えておいてそこから動かす
  test('画面の追従はブラウザの補正を巻き戻して押した時点から始まる', async (): Promise<void> => {
    twoBlocks();
    let settleWrite: () => void = () => {};
    const { scroll, setBlockSpy, restore } = stubMoveAnimation(500);
    // 書き込みが着地するタイミングをテスト側で握る
    setBlockSpy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          settleWrite = resolve;
        }),
    );

    try {
      await mount();

      // 押した時点のスクロール位置は500
      await starSecondBlock();
      expect(scroll.tops).toEqual([]);

      // 書き込みが着地する前に、ブラウザが位置を補正した状況を作る
      scroll.setScrollY(700);
      await act(async () => {
        settleWrite();
      });

      // 補正後の700ではなく、押した時点の500から動き始める
      expect(scroll.tops[0]).toBe(500);
      jest.advanceTimersByTime(600);
      expect(scroll.tops[scroll.tops.length - 1]).toBe(0);
    } finally {
      restore();
    }
  });

  // お気に入りを解除したカードは作成日順の位置（一覧の下）へ動く。
  // そこまで画面を追わせると、見ている場所から大きく下へ飛んでしまう
  test('お気に入りを解除したときは画面を追従させない', async (): Promise<void> => {
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
        starred: true,
        tabs: [{ url: 'https://example.com/b', title: 'tab-b' }],
      },
    ]);
    const { scroll, restore } = stubMoveAnimation(500);

    try {
      await mount();
      // お気に入りのブロックが先頭
      expect(
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        ),
      ).toEqual(['title-old', 'title-new']);

      // 先頭（お気に入り）のカードを解除する
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[0]!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      });

      // 並びは戻り、カードは滑るが、画面は動かさない
      expect(
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        ),
      ).toEqual(['title-new', 'title-old']);
      expect(cardTransforms()).toEqual([
        'translateY(100px)',
        'translateY(-100px)',
      ]);
      jest.advanceTimersByTime(600);
      expect(scroll.tops).toEqual([]);
    } finally {
      restore();
    }
  });

  // 先頭のブロックをお気に入りにしても並びは変わらない。
  // 位置が変わっていないカードを動かすと、その場で無駄に揺れる
  test('位置が変わらなければカードも画面も動かさない', async (): Promise<void> => {
    twoBlocks();
    const { scroll, setBlockSpy, restore } = stubMoveAnimation(500);

    try {
      await mount();

      // すでに先頭にいる1枚目（title-new）をお気に入りにする
      await act(async () => {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[0]!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      });

      expect(setBlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ indexNum: 0, starred: true }),
      );
      jest.advanceTimersByTime(600);
      expect(cardTransforms()).toEqual(['', '']);
      expect(scroll.tops).toEqual([]);
    } finally {
      restore();
    }
  });

  // アニメーションを控える設定のときは滑らせない。それでも画面は追う。
  // 追わないとブラウザのスクロール補正だけが残り、カードが画面内で飛ぶ
  test('アニメーションを控える設定なら滑らせず一度で追従する', async (): Promise<void> => {
    twoBlocks();
    const { scroll, restore } = stubMoveAnimation(500);
    const matchMediaSpy = jest
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);

    try {
      await mount();
      await starSecondBlock();

      // 並びは変わるが、滑らせはしない
      expect(
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        ),
      ).toEqual(['title-old', 'title-new']);
      jest.advanceTimersByTime(600);
      expect(cardTransforms()).toEqual(['', '']);
      // 画面は一度で移動先を見せる位置へ
      expect(scroll.tops).toEqual([0]);
    } finally {
      matchMediaSpy.mockRestore();
      restore();
    }
  });

  // storageから読み込んだ並びを固定したままだと、お気に入りにしたブロックが
  // リロードするまで先頭に来ない
  test('お気に入りにしたブロックはその場で一覧の先頭へ移る', async (): Promise<void> => {
    twoBlocks();
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

  // act()は状態更新を同期的にフラッシュするため、本番の順序
  // （storageへの書き込み→state更新→並び替えのコミット→追従）を再現できない。
  // 追従を書き込みのPromiseの中で行っていた頃は、Reactが並び替えを
  // コミットする前に走って何も起きなかった。その回帰を止める
  test('本番と同じ順序でも並び替えの後に画面が追従する', async (): Promise<void> => {
    twoBlocks();
    // このテストだけは本番のスケジューラの順序を見るため、時間を偽らずに動かす
    // （stubMoveAnimationはfake timersを張るので使えない）
    const setBlockSpy = jest
      .spyOn(chromeService.storage, 'setBlock')
      .mockResolvedValue(undefined);
    const layoutStub = stubCardLayout();
    const scroll = stubScrollableWindow(500);

    try {
      await mount();

      const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
      const previousActEnv = actEnv.IS_REACT_ACT_ENVIRONMENT;
      actEnv.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        container
          .querySelectorAll<HTMLButtonElement>('.block-star-toggle')[1]!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        // 書き込み→state更新→並び替えのコミット→追従まで進むのを待つ
        for (let i = 0; i < 50 && scroll.tops.length <= 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        actEnv.IS_REACT_ACT_ENVIRONMENT = previousActEnv;
      }

      // 並び替えが済んでいて、かつ追従は押した時点の位置から始まっている
      expect(
        Array.from(container.querySelectorAll('.block-title')).map(
          (e) => e.textContent,
        ),
      ).toEqual(['title-old', 'title-new']);
      expect(scroll.tops[0]).toBe(500);
    } finally {
      scroll.restore();
      layoutStub.mockRestore();
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
  // 一覧はマウント時のstorageの内容を持ち続けるため、他のtabsページや
  // 他の端末(sync)での変更に追随できないと、古い一覧からの書き戻しで
  // 相手の変更を消してしまう
  test('ブロックの保存データが変わると一覧を読み直す', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
    ]);

    await mount();
    expect(container.textContent).toContain('tab-a');

    // 他のtabsページがブロックに名前を付けた状況
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        title: 'title-from-other-tab',
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
    ]);
    await act(async () => {
      notifySync({ td_0: { newValue: 'changed' } });
    });

    expect(container.textContent).toContain('title-from-other-tab');
  });

  test('ブロック数が変わると一覧を読み直す', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([]);

    await mount();
    expect(container.textContent).toContain('content_msg_not_tab');

    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
    ]);
    await act(async () => {
      notifySync({ t_len: { newValue: '1' } });
    });

    expect(container.textContent).toContain('tab-a');
  });

  test.each([
    ['一覧に関係のないsyncのキー', { other: { newValue: 'x' } }, 'sync'],
    ['localの変更', { td_0: { newValue: 'x' } }, 'local'],
  ])(
    '%sでは一覧を読み直さない',
    async (
      _name: string,
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ): Promise<void> => {
      getAllBlockSpy.mockResolvedValue([]);

      await mount();
      expect(getAllBlockSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        for (const listener of onChangedListeners) {
          listener(changes, areaName);
        }
      });

      expect(getAllBlockSpy).toHaveBeenCalledTimes(1);
    },
  );

  // 変更が連続すると読み直しが並行する。先に始まった読み込みが後から着地して
  // 古い一覧に戻してしまうと、追随したつもりで stale な state に戻る
  test('読み直しが並行しても後から始めた結果が残る', async (): Promise<void> => {
    getAllBlockSpy.mockResolvedValue([
      {
        indexNum: 0,
        createdAt: new Date('2021-01-02T03:04:05.678Z'),
        tabs: [{ url: 'https://example.com/a', title: 'tab-a' }],
      },
    ]);

    await mount();

    let resolveStale: (entries: model.BlockEntry[]) => void = () => undefined;
    getAllBlockSpy.mockImplementationOnce(
      () =>
        new Promise<model.BlockEntry[]>((resolve) => {
          resolveStale = resolve;
        }),
    );
    getAllBlockSpy.mockImplementationOnce(() =>
      Promise.resolve([
        {
          indexNum: 0,
          createdAt: new Date('2021-01-02T03:04:05.678Z'),
          tabs: [{ url: 'https://example.com/c', title: 'tab-c' }],
        },
      ]),
    );

    // 1回目(遅い)と2回目(速い)の読み直しを続けて始めさせる
    await act(async () => {
      notifySync({ td_0: { newValue: 'first' } });
      notifySync({ td_0: { newValue: 'second' } });
    });
    expect(container.textContent).toContain('tab-c');

    // 遅れて着地した1回目の結果は捨てる
    await act(async () => {
      resolveStale([
        {
          indexNum: 0,
          createdAt: new Date('2021-01-02T03:04:05.678Z'),
          tabs: [{ url: 'https://example.com/b', title: 'tab-b' }],
        },
      ]);
    });

    expect(container.textContent).toContain('tab-c');
    expect(container.textContent).not.toContain('tab-b');
  });
});

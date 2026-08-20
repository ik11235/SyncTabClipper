import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { model } from '../types/interface';
import { blockService } from '../blockService';

/*
 * お気に入りの付け外しで並び替わったカードの移動を見せる (#196)
 *
 * レイアウトは新しい位置で確定させたまま、transformだけを元の位置から戻して
 * 移動を見せる（FLIP）。一覧の高さもスクロール量も変えないので、他の操作の
 * 邪魔をしない。
 *
 * お気に入りを付けたカードは移動先が画面の外になりうるので、先に画面をその
 * 位置まで動かし、着いてからカードを滑らせてくる。画面とカードを同時に動かすと
 * カードが画面内の同じ場所に留まってしまい、周囲だけが動いて本人は移動して
 * いないように見える（先頭へ動く場合はスクロールが上端で打ち止めになる分だけ
 * カードが自力で滑るが、途中の位置へ動く場合は画面が完全に追いついてしまう）。
 */

const SCROLL_DURATION_MS = 300;
const SLIDE_DURATION_MS = 500;

// 一覧の中でカードを見分けるための印。BlockとBrokenBlockが付けている
const CARD_SELECTOR = '[data-block-index]';

type CardMove = {
  card: HTMLElement;
  // 動き始めの位置。新しい位置からの相対値なので、0へ戻すと移動が終わる
  startOffset: number;
};

type CameraMove = {
  // 動き始めのスクロール位置
  from: number;
  // カードが滑ってくる先を見せるスクロール位置
  to: number;
};

/**
 * スクロール位置を実際に動かせる範囲へ収める
 * @param {number} top 動かしたいスクロール位置
 * @return {number} 実際に動かせるスクロール位置
 */
function clampScrollTop(top: number): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, Math.min(top, Math.max(0, max)));
}

/**
 * ease-in-outのイージング。等速だと動き出しと止まりが唐突に見える
 * @param {number} progress 0から1までの進み具合
 * @return {number} 補正した進み具合
 */
function easeInOut(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

/**
 * カードが滑ってくる先を見せるためのスクロール位置を求める
 * @param {number} top カードの移動先（レイアウト上の位置）
 * @param {number} height カードの高さ
 * @param {number} scrollY 動かす前のスクロール位置
 * @return {number} 動かす先のスクロール位置。動かす必要がなければそのままの位置
 */
function cameraTopFor(top: number, height: number, scrollY: number): number {
  const viewport = window.innerHeight;
  if (top >= scrollY && top + height <= scrollY + viewport) {
    // 移動先がすでに画面に入っている。動かすと見ている位置が理由もなくずれる
    return scrollY;
  }
  // 画面の中央あたりに移動先を置く。上端や下端に寄せると、そこへ滑ってくる
  // カードが画面の外から現れて動きの半分が見えない
  return clampScrollTop(top - Math.max(0, (viewport - height) / 2));
}

/**
 * 画面を移動先へ動かしてから、カードをそこへ滑らせる。
 * 画面を動かしている間はカードを元の位置に留めておき、着いてから滑らせる
 * @param {CardMove[]} moves 動かすカード
 * @param {CameraMove | null} camera 動かす画面。動かさない場合はnull
 * @return {() => void} 途中で止める関数
 */
function startCardMoves(
  moves: CardMove[],
  camera: CameraMove | null,
): () => void {
  const slideCards = (eased: number): void => {
    for (const move of moves) {
      // 進み切ったらインラインスタイルを残さない
      move.card.style.transform =
        eased >= 1 ? '' : `translateY(${move.startOffset * (1 - eased)}px)`;
    }
  };

  // 最初のフレームを待たずに動き始めの状態にする。レイアウトeffectの中で
  // 描画前に効かせ、新しい位置が一瞬見えるのを防ぐ
  slideCards(0);
  if (camera != null) {
    // 画面の位置も押した時点へ戻す。カードが動いた瞬間にブラウザの
    // スクロールアンカリングが位置を補正するため、そのままでは
    // 押したときに見えていた景色から始まらない
    window.scrollTo({ top: camera.from });
  }

  // 動かす必要がない画面に時間をかけない
  const scrollMs =
    camera == null || camera.from === camera.to ? 0 : SCROLL_DURATION_MS;
  // 画面が移動先へ着いたか。着いた後も毎フレーム同じ位置を指示しないための目印で、
  // 第1段を終えて第2段へ移る合図も兼ねる
  let scrollSettled = scrollMs <= 0;
  let startedAt: number | null = null;
  let frame = 0;
  const step = (now: number): void => {
    if (startedAt == null) {
      startedAt = now;
    }
    const elapsed = now - startedAt;
    // 第1段: 画面を移動先へ動かす
    if (camera != null && !scrollSettled) {
      const progress = Math.min(elapsed / scrollMs, 1);
      window.scrollTo({
        top: camera.from + (camera.to - camera.from) * easeInOut(progress),
      });
      scrollSettled = progress >= 1;
    }
    // 第2段: 画面が着いてからカードを滑らせる
    if (scrollSettled) {
      const progress = Math.min((elapsed - scrollMs) / SLIDE_DURATION_MS, 1);
      slideCards(progress >= 1 ? 1 : easeInOut(progress));
      if (progress >= 1) {
        return;
      }
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  return (): void => {
    cancelAnimationFrame(frame);
    // 中断してもカードは新しい位置に着かせる。transformが残ると位置がずれたまま。
    // 画面はここでは動かさない（次の移動が自分の行き先へ動かすので、
    // 途中の行き先へ寄せても直後に上書きされるだけ）
    slideCards(1);
  };
}

/**
 * 一覧のお気に入りの状態を取り出す。
 * 復元できなかったブロックはお気に入りだったかも分からないので数えない
 * @param {model.BlockEntry[]} blocks 一覧
 * @return {Map<number, boolean>} indexNumごとのお気に入りの状態
 */
function starredByIndexNum(blocks: model.BlockEntry[]): Map<number, boolean> {
  const starred = new Map<number, boolean>();
  for (const entry of blocks) {
    if (!blockService.isBrokenBlock(entry)) {
      starred.set(entry.indexNum, entry.starred === true);
    }
  }
  return starred;
}

/**
 * お気に入りが付いた瞬間のブロックを探す。
 * storage.onChangedは購読していないので、状態が変わるのはこの画面の操作に
 * よるときだけ。付いたカードは移動先が画面の外になりうるため画面ごと動かす
 * @param {Map<number, boolean>} starred 今回のお気に入りの状態
 * @param {Map<number, boolean>} previous 直前のコミットでのお気に入りの状態
 * @return {number | null} 付いたブロックのindexNum。なければnull
 */
function findNewlyStarred(
  starred: Map<number, boolean>,
  previous: Map<number, boolean>,
): number | null {
  for (const [indexNum, isStarred] of starred) {
    if (isStarred && previous.get(indexNum) === false) {
      return indexNum;
    }
  }
  return null;
}

/**
 * 並び替えで移動したカードの動きを見せる。
 * 返したrefをカードの入れ物に渡す
 * @param {model.BlockEntry[]} blocks 表示している一覧
 * @return {RefObject} カードの入れ物に渡すref
 */
export function useBlockMoveAnimation(
  blocks: model.BlockEntry[],
): RefObject<HTMLDivElement | null> {
  const listRoot = useRef<HTMLDivElement>(null);
  // 直前のコミットでの各カードの位置。getBoundingClientRectはスクロールでも
  // 値が変わり、移動アニメーション中のtransformも拾ってしまうため、
  // レイアウト上の位置(offsetTop)で持つ
  const previousTops = useRef(new Map<number, number>());
  // 直前のコミットでのスクロール位置。カードが移動した瞬間はブラウザの
  // スクロールアンカリングが位置を補正するため、押した時点の位置は
  // 自分で覚えておく必要がある
  const previousScrollY = useRef(0);
  const previousStarred = useRef(new Map<number, boolean>());
  const stopRunningMoves = useRef<(() => void) | null>(null);

  // 依存配列を持たないのは、カードの高さが変わる操作（名前の編集など）でも
  // 位置がずれるため。記録が古いままだと、次の並び替えで存在しない位置から
  // 滑り出してしまう
  useLayoutEffect(() => {
    const list = listRoot.current;
    if (list == null) {
      return;
    }
    const scrollYBefore = previousScrollY.current;
    previousScrollY.current = window.scrollY;

    const starred = starredByIndexNum(blocks);
    const newlyStarred = findNewlyStarred(starred, previousStarred.current);
    previousStarred.current = starred;

    const nextTops = new Map<number, number>();
    const moves: CardMove[] = [];
    let camera: CameraMove | null = null;
    for (const card of list.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
      const indexNum = Number(card.dataset.blockIndex);
      const top = card.offsetTop;
      nextTops.set(indexNum, top);
      const previousTop = previousTops.current.get(indexNum);
      if (previousTop == null || previousTop === top) {
        continue;
      }
      moves.push({ card: card, startOffset: previousTop - top });
      if (indexNum === newlyStarred) {
        camera = {
          from: scrollYBefore,
          to: cameraTopFor(top, card.offsetHeight, scrollYBefore),
        };
      }
    }
    previousTops.current = nextTops;
    if (moves.length <= 0) {
      return;
    }

    // 前の移動が走っている間に次の移動が始まったら、前のぶんは行き先へ
    // 着かせて終わらせる（transformが残ると位置がずれたままになる）
    stopRunningMoves.current?.();
    stopRunningMoves.current = null;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // アニメーションを控える設定では滑らせない。それでも移動先は見せる。
      // 見せないとアンカリングの補正だけが残り、カードが画面内で飛ぶ
      if (camera != null) {
        window.scrollTo({ top: camera.to });
      }
      return;
    }
    stopRunningMoves.current = startCardMoves(moves, camera);
  });

  // 一覧が消えるときに動かし続けない
  useEffect(
    () => (): void => {
      stopRunningMoves.current?.();
      stopRunningMoves.current = null;
    },
    [],
  );

  return listRoot;
}

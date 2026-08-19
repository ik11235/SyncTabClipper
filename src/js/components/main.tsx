import { model } from '../types/interface';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { blockService } from '../blockService';
import Block from './block';
import BrokenBlock from './brokenBlock';
import { ErrorBoundary } from './errorBoundary';

interface MainProps {
  blocks: model.BlockEntry[];
  updateBlock: (newBlock: model.Block) => Promise<void>;
  deleteBrokenBlock: (indexNum: number) => void;
}

// カードが並び替えで移動するときにかける時間。
// 瞬間移動させるとどこからどこへ動いたのか分からないため、
// 元の位置から新しい位置まで滑らせて見せる
const BLOCK_MOVE_DURATION_MS = 500;

// 移動するカードと、それに追従する画面のスクロール。
// カードのtransformと画面のスクロールを同じ時計・同じイージングで動かす。
// 別々に動かすと、画面が先に移動先へ着いてしまってカードの移動が見えない
type BlockMove = {
  card: HTMLElement;
  // 動き始めの位置（新しい位置からの相対値）
  offset: number;
};

type CameraMove = {
  // 動き始めのスクロール位置
  from: number;
  // 追うカードのレイアウト上の移動量。これと同じだけ画面を動かすと、
  // カードは画面内の同じ場所に留まり、周囲のカードが流れて見える
  delta: number;
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
 * カードの移動と画面の追従を一定時間かけて動かす。
 * requestAnimationFrameで自前に動かすのは、カードのtransformと画面の
 * スクロールを1つの時計で進めて、ずれないようにするため
 * @param {BlockMove[]} moves 動かすカード
 * @param {CameraMove | null} camera 追従させる画面。追わない場合はnull
 * @param {number} duration かける時間(ms)
 * @return {() => void} 途中で止める関数
 */
function animateBlockMoves(
  moves: BlockMove[],
  camera: CameraMove | null,
  duration: number,
): () => void {
  const apply = (eased: number): void => {
    for (const move of moves) {
      // 進み切ったらインラインスタイルを残さない
      move.card.style.transform =
        eased >= 1 ? '' : `translateY(${move.offset * (1 - eased)}px)`;
    }
    if (camera != null) {
      window.scrollTo({
        top: clampScrollTop(camera.from + camera.delta * eased),
      });
    }
  };
  // 最初のフレームを待たずに動き始めの位置へ置く。
  // レイアウトeffectの中で描画前に効かせ、新しい位置が一瞬見えるのを防ぐ
  apply(0);
  let startedAt: number | null = null;
  let frame = 0;
  const step = (now: number): void => {
    if (startedAt == null) {
      startedAt = now;
    }
    const progress = Math.min((now - startedAt) / duration, 1);
    apply(progress >= 1 ? 1 : easeInOut(progress));
    if (progress < 1) {
      frame = requestAnimationFrame(step);
    }
  };
  frame = requestAnimationFrame(step);
  return (): void => {
    cancelAnimationFrame(frame);
    // 中断しても新しい位置には着かせる。transformが残ると位置がずれたまま
    apply(1);
  };
}

// ブロック一覧のstateはAppが所有し、Mainはpropsの表示に徹する
const Main: React.FC<MainProps> = (props) => {
  const listRoot = useRef<HTMLDivElement>(null);
  // 直前のコミットでの各カードの位置。getBoundingClientRectはスクロールでも
  // 値が変わり、移動アニメーション中のtransformも拾ってしまうため、
  // レイアウト上の位置(offsetTop)で持つ
  const previousTops = useRef(new Map<number, number>());
  // 直前のコミットでのスクロール位置。カードが移動した瞬間は、ブラウザの
  // スクロールアンカリングが見えている内容を保とうとしてスクロール位置を
  // 勝手に補正するため、押した時点の位置は自分で覚えておく必要がある
  const previousScrollY = useRef(0);
  // 直前のコミットでのお気に入りの状態。付いた瞬間のカードを画面が追う
  const previousStarred = useRef(new Map<number, boolean>());
  const cancelRunningMoves = useRef<(() => void) | null>(null);

  // お気に入りの付け外しでカードは一覧内を移動する。レイアウトは新しい位置で
  // 確定させたまま、transformだけを元の位置から戻すことで移動を見せる（FLIP）。
  // 一覧の高さもスクロール量も変えないので、他の操作の邪魔をしない。
  //
  // お気に入りが付いたカードは、それと同じだけ画面もスクロールさせて追う。
  // カードは画面内の同じ場所に留まり、周囲のカードが流れて見えるので、
  // 「どこからどこへ動いたか」が分かる。画面を先に移動先へ動かしてしまうと、
  // 着いた先でカードが現れるだけになって移動が見えない。
  //
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

    // お気に入りが付いた瞬間のカードを探す。storage.onChangedは購読して
    // いないので、状態が変わるのはこの画面の操作によるときだけ
    const nextStarred = new Map<number, boolean>();
    let followIndexNum: number | null = null;
    for (const entry of props.blocks) {
      if (blockService.isBrokenBlock(entry)) {
        continue;
      }
      const starred = entry.starred === true;
      nextStarred.set(entry.indexNum, starred);
      if (starred && previousStarred.current.get(entry.indexNum) === false) {
        followIndexNum = entry.indexNum;
      }
    }
    previousStarred.current = nextStarred;

    const nextTops = new Map<number, number>();
    const moves: BlockMove[] = [];
    let camera: CameraMove | null = null;
    for (const card of list.querySelectorAll<HTMLElement>(
      '[data-block-index]',
    )) {
      const indexNum = Number(card.dataset.blockIndex);
      const top = card.offsetTop;
      nextTops.set(indexNum, top);
      const previousTop = previousTops.current.get(indexNum);
      if (previousTop == null || previousTop === top) {
        continue;
      }
      moves.push({ card: card, offset: previousTop - top });
      if (indexNum === followIndexNum) {
        // 動き始めは押した時点のスクロール位置。アンカリングによる補正を
        // ここで巻き戻し、押したときに見えていた景色から動かし始める
        camera = { from: scrollYBefore, delta: top - previousTop };
      }
    }
    previousTops.current = nextTops;
    if (moves.length <= 0) {
      return;
    }

    // 前の移動が走っている間に次の移動が始まったら、前のぶんは行き先へ
    // 着かせて終わらせる（transformが残ると位置がずれたままになる）
    cancelRunningMoves.current?.();
    cancelRunningMoves.current = null;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // アニメーションを控える設定では滑らせない。それでも画面は追う。
      // 追わないとアンカリングの補正だけが残り、カードが画面内で飛ぶ
      if (camera != null) {
        window.scrollTo({ top: clampScrollTop(camera.from + camera.delta) });
      }
      return;
    }
    cancelRunningMoves.current = animateBlockMoves(
      moves,
      camera,
      BLOCK_MOVE_DURATION_MS,
    );
  });

  // 一覧が消えるときに動かし続けない
  useEffect(
    () => (): void => {
      cancelRunningMoves.current?.();
      cancelRunningMoves.current = null;
    },
    [],
  );

  if (props.blocks.length > 0) {
    return (
      <div ref={listRoot}>
        {props.blocks.map((entry) =>
          blockService.isBrokenBlock(entry) ? (
            <BrokenBlock
              key={entry.indexNum}
              indexNum={entry.indexNum}
              unsupported={entry.unsupported}
              // 復元できなかったブロックはロックしていたかも分からない
              locked={false}
              deleteBlock={props.deleteBrokenBlock}
            />
          ) : (
            // 壊れたデータ1件のレンダリング時例外で一覧全体が失われないよう、
            // ブロック単位で境界を置く。落ちたブロックは
            // 復元できなかったブロックと同じ削除できるカードに差し替える
            <ErrorBoundary
              key={entry.indexNum}
              fallback={
                <BrokenBlock
                  indexNum={entry.indexNum}
                  unsupported={false}
                  // 描画に失敗するとロックを解除する導線ごと失われるため、
                  // ロックしていたことを削除前の警告として引き継ぐ
                  locked={entry.locked === true}
                  deleteBlock={props.deleteBrokenBlock}
                />
              }
            >
              <Block block={entry} updateBlock={props.updateBlock} />
            </ErrorBoundary>
          ),
        )}
      </div>
    );
  } else {
    return (
      <div className="uk-header">
        <h3 className="uk-title uk-margin-remove-bottom no-tabs">
          {chrome.i18n.getMessage('content_msg_not_tab')}
        </h3>
      </div>
    );
  }
};
export default Main;

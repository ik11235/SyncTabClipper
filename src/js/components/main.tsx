import { model } from '../types/interface';
import React, { useLayoutEffect, useRef } from 'react';
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

// ブロック一覧のstateはAppが所有し、Mainはpropsの表示に徹する
const Main: React.FC<MainProps> = (props) => {
  const listRoot = useRef<HTMLDivElement>(null);
  // 直前のコミットでの各カードの位置。getBoundingClientRectはスクロールでも
  // 値が変わり、移動アニメーション中のtransformも拾ってしまうため、
  // レイアウト上の位置(offsetTop)で持つ
  const previousTops = useRef(new Map<number, number>());
  const runningMoves = useRef(new Map<number, Animation>());

  // お気に入りの付け外しでカードは一覧内を移動する。レイアウトは新しい位置で
  // 確定させたまま、transformだけを元の位置から戻すことで移動を見せる（FLIP）。
  // 一覧の高さもスクロール量も変えないので、他の操作の邪魔をしない。
  //
  // 依存配列を持たないのは、カードの高さが変わる操作（名前の編集など）でも
  // 位置がずれるため。記録が古いままだと、次の並び替えで存在しない位置から
  // 滑り出してしまう。
  // 子のレイアウトeffect（Blockの追随スクロール）はこれより先に走るので、
  // あちらがカードの位置を測る時点ではまだtransformが載っていない
  useLayoutEffect(() => {
    const list = listRoot.current;
    if (list == null) {
      return;
    }
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const nextTops = new Map<number, number>();
    for (const card of list.querySelectorAll<HTMLElement>(
      '[data-block-index]',
    )) {
      const indexNum = Number(card.dataset.blockIndex);
      const top = card.offsetTop;
      nextTops.set(indexNum, top);
      const previousTop = previousTops.current.get(indexNum);
      if (reduceMotion || previousTop == null || previousTop === top) {
        continue;
      }
      // 前の移動が残っていると行き先が混ざる
      runningMoves.current.get(indexNum)?.cancel();
      runningMoves.current.set(
        indexNum,
        card.animate(
          [
            { transform: `translateY(${previousTop - top}px)` },
            { transform: 'none' },
          ],
          { duration: BLOCK_MOVE_DURATION_MS, easing: 'ease-in-out' },
        ),
      );
    }
    // 一覧から消えたカードのアニメーションは追跡し続ける必要がない
    for (const [indexNum, move] of runningMoves.current) {
      if (!nextTops.has(indexNum)) {
        move.cancel();
        runningMoves.current.delete(indexNum);
      }
    }
    previousTops.current = nextTops;
  });

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

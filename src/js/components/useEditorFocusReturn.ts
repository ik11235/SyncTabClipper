import { RefObject, useEffect, useRef } from 'react';

/*
 * 編集をやめたあとのフォーカス復帰 (#253)
 *
 * 名前のインライン編集(#254)とタブの追加モーダル(#253)で、閉じたあとに
 * 「開いたときのボタンへ戻す」処理が同型で並んだ。閉じると見出しごと
 * フォームが消えるため、フォーカスがbodyまで落ちてキーボード操作の
 * 現在位置が失われる。
 *
 * 判断が2つある。
 *
 * 1. 閉じる処理の中ではなく、commit後に戻す
 *    復帰先のボタンは、開いている間inertになる領域の中にある。閉じる処理の
 *    中で同期にfocus()を呼ぶと、state更新がバッチされてDOMがまだ前回の
 *    renderのままで、inert配下へのfocus()になる。実ブラウザでは黙って
 *    無視されるため、フォーカスはbodyに落ちたままになる。
 *    jsdomはinertによるフォーカス遮断を実装していないので、
 *    activeElementを見るだけのテストではこの取りこぼしに気付けない。
 *
 * 2. カードの外へ移っていたら奪い返さない
 *    保存は非同期で、待っている間にユーザーがフォーカスを移していることが
 *    ある。そこから奪い返すと入力先が飛ぶ。
 */

/**
 * 編集が閉じたら、開いたときのボタンへフォーカスを戻す。
 * @param {boolean} open 編集を開いているか
 * @param {RefObject<HTMLButtonElement | null>} buttonRef 戻す先のボタン
 * @param {RefObject<HTMLElement | null>} cardRootRef 奪い返してよい範囲
 * @return {void}
 */
export function useEditorFocusReturn(
  open: boolean,
  buttonRef: RefObject<HTMLButtonElement | null>,
  cardRootRef: RefObject<HTMLElement | null>,
): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      if (
        active == null ||
        active === document.body ||
        cardRootRef.current?.contains(active) === true
      ) {
        buttonRef.current?.focus();
      }
    }
    wasOpen.current = open;
  }, [open, buttonRef, cardRootRef]);
}

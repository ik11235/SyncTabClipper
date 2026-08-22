import { RefObject, useEffect, useRef, useState } from 'react';
import { model } from '../types/interface';

/*
 * カード全体に効く真偽値フラグの切り替え (#254)
 *
 * ロック(#194)とお気に入り(#196)は「ブロックの真偽値フラグを1つ裏返して
 * storageへ書き戻す」という同じ振る舞いで、状態・トグル・フォーカス復帰まで
 * 同型の実装が2組並んでいた。ここへ寄せる。
 *
 * 設計上の判断が2つある。
 *
 * 1. 開始条件はフックの外で決める
 *    切り替えを始めてよいかの判定は「他方の保存中でないこと」を含むため、
 *    自分のsavingしか知らないフックには組み立てられない。呼び出し側が
 *    両方のsavingを見て算出したものを、遅延評価の関数として受け取る
 *    （フックを呼ぶ時点ではまだ算出されていないので、値では渡せない）。
 *    判定そのものは呼び出し側に残るが、「押せないときは何もしない」という
 *    不変条件はここで守る。ボタンのdisabledだけに預けると、導線が増えたときに
 *    保護が黙って外れる
 *
 * 2. フォーカス復帰のpreventScrollはオプションにする
 *    お気に入りはカードが一覧内を移動し、useBlockMoveAnimationが画面の
 *    スクロールを見せるため、フォーカスに伴うブラウザの瞬間スクロールを
 *    抑える必要がある。ロックはカードが動かないので抑える理由がなく、
 *    むしろ画面外のボタンへフォーカスが戻ったときに見えるところまで
 *    運んでくれる。揃えるとロック側の挙動(#194)を変えることになるため、
 *    違いを違いのまま残す
 */

/*
 * 切り替えの対象にできるフィールド。
 * 立っていない状態をキーなしで表すため、undefinedを許す真偽値のキーだけを拾う。
 * 計算プロパティ（[field]: ...）は書き込む値の型を検査せず、
 * 'locked' | 'starred' と手で書くと将来キーを足すときに
 * 真偽値でないフィールド（titleなど）を混ぜても通ってしまう。
 * その状態で押すと{...current, title: true}がstorageまで届き、
 * 名前がtrueとして保存される
 */
type BooleanFlagKeys<T> = {
  [K in keyof T]-?: undefined extends T[K]
    ? NonNullable<T[K]> extends boolean
      ? K
      : never
    : never;
}[keyof T];

export type BlockFlagField = BooleanFlagKeys<model.Block>;

export type BlockFlagToggleOptions = {
  // 対象のブロック。indexNumの取得と、書き換わったら失敗表示を消すのに使う
  block: model.Block;
  field: BlockFlagField;
  // storageへの書き戻し。更新関数を渡す形はApp側と同じ(#248)
  updateBlock: (
    indexNum: number,
    update: (current: model.Block) => model.Block,
  ) => Promise<void>;
  // 書き込みを飛行中として数える。名前の編集との相互排他に使う
  track: <T>(work: Promise<T>) => Promise<T>;
  // 切り替えを始めてよいか。クリックの時点で評価する
  canStart: () => boolean;
  // 失敗したときにカード内へ出す文言のキー。
  // getMessageは知らないキーに空文字を返し、中身のない赤字と
  // 空のrole="alert"を出してしまうので、実在するキーだけに絞る
  failureMessageKey:
    'content_msg_lock_block_save_failed' | 'content_msg_star_block_save_failed';
  // フォーカスを戻すときにブラウザの瞬間スクロールを抑えるか
  preventScroll?: boolean;
};

export type BlockFlagToggle = {
  // 押したときに見えている状態
  active: boolean;
  // 書き込みが飛行中か。着地するまでpropsは古いままなので、
  // 呼び出し側はこれを見てタブ側の導線を止める
  saving: boolean;
  // 失敗をカード内で伝える文言。成功や別の更新で消える
  error: string | null;
  buttonRef: RefObject<HTMLButtonElement | null>;
  toggle: (event: React.MouseEvent) => void;
};

/**
 * ブロックの真偽値フラグを切り替えてstorageへ反映する。
 * @param {BlockFlagToggleOptions} options 切り替えの対象と周辺の依存
 * @return {BlockFlagToggle} 表示と操作に必要な状態・ハンドラ
 */
export function useBlockFlagToggle(
  options: BlockFlagToggleOptions,
): BlockFlagToggle {
  const { block, field, updateBlock, track, canStart, failureMessageKey } =
    options;
  const active = block[field] === true;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // 切り替えをキーボードから起動したか
  const keyboardActivated = useRef(false);

  const toggle = (event: React.MouseEvent): void => {
    if (!canStart()) {
      return;
    }
    // キーボードから起動したクリックはdetailが0になる。
    // ブラウザはmousedownでもボタンにフォーカスを移すため、
    // activeElementを見てもマウス操作と区別できない
    keyboardActivated.current = event.detail === 0;
    setError(null);
    setSaving(true);
    track(
      updateBlock(block.indexNum, (current) => ({
        ...current,
        // 立っていない状態はキーを持たない形で表す（保存側もそう書く）。
        // 押したときに見えていた状態の裏返しにする。書き込む直前の内容から
        // 裏返すと、待っている間に他のページで切り替わっていた場合に
        // ユーザーが押したのと逆の結果になる
        [field]: active ? undefined : true,
      })),
    ).then(
      () => {
        setSaving(false);
      },
      () => {
        setSaving(false);
        // App側のアラートはページ最上部に出るためスクロール中は気付けない。
        // 押しても状態が変わらない理由をカード内でも伝える
        setError(chrome.i18n.getMessage(failureMessageKey));
      },
    );
  };

  // ボタンは押した瞬間に自分がdisabledになるため、ブラウザがフォーカスを
  // bodyへ落とす。書き込みが決着したらキーボード操作の現在位置を戻す。
  // 名前の編集と違い、押した後もボタン自体は同じ場所に残るので、
  // フォーカスが失われている場合だけ戻せば足りる。
  // お気に入りはカードが一覧内を移動するが、ボタンはアンマウントされないので
  // refから同じ要素へ戻せる
  const wasSaving = useRef(false);
  const preventScroll = options.preventScroll === true;
  useEffect(() => {
    if (wasSaving.current && !saving) {
      // キーボードから押したときだけ戻す。マウスで押してから別の場所を
      // クリックした場合もフォーカスはbodyに落ちるため、bodyかどうかだけで
      // 判断すると、見ている位置から勝手にスクロールが戻ってしまう
      const activeElement = document.activeElement;
      if (
        keyboardActivated.current &&
        (activeElement == null || activeElement === document.body)
      ) {
        buttonRef.current?.focus({ preventScroll: preventScroll });
      }
    }
    wasSaving.current = saving;
  }, [saving, preventScroll]);

  // 別の操作が成功してブロックが書き換わったら、前の失敗の赤字は現在の状態を
  // 説明していない。直近の操作が失敗したかのように見えるため消す。
  // 一覧の読み直し(#249)でも新しいオブジェクトが降りてくるため、他端末の
  // 変更で赤字が消えることはある。失敗自体はerrorLog経由でページ上部の
  // アラートに残るので、消える方に倒している
  useEffect(() => {
    setError(null);
  }, [block]);

  return {
    active: active,
    saving: saving,
    error: error,
    buttonRef: buttonRef,
    toggle: toggle,
  };
}

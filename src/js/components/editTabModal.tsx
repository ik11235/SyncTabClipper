import React, { useId, useRef, useState } from 'react';
import { model } from '../types/interface';
import { util } from '../util';

interface EditTabModalProps {
  tab: model.Tab;
  /**
   * 既存のタブを直すのか、新しいタブを足すのか(#253)。
   * 入力欄・検証・保存の流れは同じなので、見出しと保存ボタンの文言だけを
   * 切り替える。省略したときは従来どおり編集として扱う
   */
  mode?: 'edit' | 'add';
  /**
   * 編集を始めたタブが、外からの変更（一覧の読み直し）で入れ替わったか。
   * trueのときは保存できない。indexで指した先が別のタブになっているため、
   * そのまま書くと無関係なタブを上書きする
   */
  targetLost?: boolean;
  /**
   * 開いている間にブロックがロックされたか。
   * trueのときは保存できない。書きにいっても必ず弾かれるので、
   * 「保存に失敗しました」を繰り返させず理由を出して止める
   */
  locked?: boolean;
  // storageへの永続化が終わるまで待つ。失敗時はrejectされるため、
  // モーダルを開いたまま入力を保持して再試行できる
  onSave: (newTab: model.Tab) => Promise<void>;
  onCancel: VoidFunction;
}

/**
 * タブのtitle/URLを編集するモーダル。
 *
 * UIkitのモーダル(data-uk-modal)はUIkit自身がDOMノードを移動・削除するため
 * Reactの管理下と共存できない。開閉はstateで制御し、UIkitからは
 * CSSクラスだけを借りる
 */
/**
 * 保存データのtitle/urlは型では文字列だが、実際には文字列とは限らない
 * （createBlockが`tab.title!`で入れるためundefinedがJSON.stringifyで
 * キーごと落ちる、インポートしたJSONに型の検証がない）。
 * そのままstateに入れると入力欄が非制御になり、保存時にtrimで例外になる
 * 引数をunknownで受けるのは、model.Tabの型を信じると
 * この判定が「不可能な条件」として消されてしまうため
 * @param {unknown} value 保存データが持っていた値
 * @return {string} 入力欄に入れる文字列
 */
const toInputValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  // 数値になったタイトルなど、直せる情報は捨てずに文字列として見せる。
  // オブジェクトは[object Object]になって直す手がかりにならないうえ、
  // Stringが例外を投げうる値もあるため空欄にする
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

export const EditTabModal: React.FC<EditTabModalProps> = (props) => {
  const [title, setTitle] = useState(toInputValue(props.tab.title));
  const [url, setUrl] = useState(toInputValue(props.tab.url));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const adding = props.mode === 'add';
  // 保存を止める理由。どちらも書きにいっても弾かれるので、押させない
  const blocked = props.targetLost === true || props.locked === true;
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const titleFieldId = useId();
  const urlFieldId = useId();
  const onCancel = props.onCancel;

  /**
   * ダイアログの中のキー操作。
   *
   * Escapeをdocumentで拾うと、モーダルが2枚開いているときに1回のEscで
   * 両方が閉じ、書きかけの入力まで一緒に消える。モーダルの中だけで拾う。
   *
   * 保存中に閉じられると、書き込みの結果を受け取る相手がいなくなる。
   * 「キャンセルしたのに保存されていた」「後から着地した保存が次に開いた
   * モーダルを閉じる」といった状態を作らないため、保存中はEscもキャンセルも
   * 効かせない（storage.syncの書き込みは必ず成功か失敗で決着する）。
   *
   * Tabはダイアログの中で循環させる。aria-modalを名乗る以上キーボードでも
   * 背後へ出られてはいけないし、出られると背後のカードの導線を操作して
   * モーダルを重ねて開けてしまう（オーバーレイはポインタしか塞がない）
   * @param {React.KeyboardEvent} event キーイベント
   * @return {void}
   */
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (!saving) {
        onCancel();
      }
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled])',
      ) ?? [],
    );
    if (focusable.length <= 0) {
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (blocked) {
      return;
    }
    const newTitle = title.trim();
    const newUrl = url.trim();
    // titleが空だとリンクの文字が消えてクリックできなくなる
    if (newTitle.length <= 0) {
      setError(chrome.i18n.getMessage('content_msg_edit_tab_title_required'));
      return;
    }
    // URLとして解釈できない文字列を弾く。スキームまでは見ないため、
    // これを通っても開けるURLとは限らない。
    // 手入力の導線(#253)ができてchrome.tabs.createが受け付けないURLを
    // 入れやすくなったが、許可リストで絞るとchrome://newtabのような
    // 使い方まで奪うため、スキームは見ない方針のままとする
    if (!util.isValidUrl(newUrl)) {
      setError(chrome.i18n.getMessage('content_msg_edit_tab_url_invalid'));
      return;
    }
    setError(null);
    setSaving(true);
    props.onSave({ title: newTitle, url: newUrl }).catch(() => {
      // App側がerrorLogへ記録するアラートはページ最上部に出るが、
      // モーダルのオーバーレイの裏になって読めない。失敗したことは
      // モーダル内でも伝え、入力を残したまま再試行できる状態に戻す
      setError(chrome.i18n.getMessage('content_msg_edit_tab_save_failed'));
      setSaving(false);
    });
  };

  return (
    <div
      className="uk-modal uk-open edit-tab-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      ref={dialog}
      onKeyDown={onKeyDown}
    >
      <div className="uk-modal-dialog uk-modal-body">
        <h2 className="uk-modal-title" id={headingId}>
          {chrome.i18n.getMessage(
            adding ? 'content_msg_add_tab' : 'content_msg_edit_tab_heading',
          )}
        </h2>
        <form onSubmit={submit}>
          <div className="uk-margin">
            <label className="uk-form-label" htmlFor={titleFieldId}>
              {chrome.i18n.getMessage('content_msg_edit_tab_title_label')}
            </label>
            <input
              id={titleFieldId}
              className="uk-input edit-tab-title"
              type="text"
              value={title}
              autoFocus={true}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="uk-margin">
            <label className="uk-form-label" htmlFor={urlFieldId}>
              {chrome.i18n.getMessage('content_msg_edit_tab_url_label')}
            </label>
            <input
              id={urlFieldId}
              className="uk-input edit-tab-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          {/* 入力の直後にエラーを置き、どこを直せばよいか分かるようにする。
              保存ボタンが無反応に見えないよう、role=alertで読み上げさせる */}
          {error != null ? (
            <p className="uk-text-danger edit-tab-error" role="alert">
              {error}
            </p>
          ) : null}
          {/* 編集していたタブが外からの変更で入れ替わった。入力は残したまま
              保存だけを止め、書いていた内容を自分で拾えるようにする */}
          {props.targetLost === true ? (
            <p className="uk-text-danger edit-tab-target-lost" role="alert">
              {chrome.i18n.getMessage('content_msg_edit_tab_target_lost')}
            </p>
          ) : null}
          {/* 開いている間にロックされた。理由を出さないと
              「保存に失敗しました」を永久に繰り返させることになる */}
          {props.locked === true ? (
            <p className="uk-text-danger edit-tab-locked" role="alert">
              {chrome.i18n.getMessage('content_msg_locked_action_disabled')}
            </p>
          ) : null}
          <div className="uk-text-right">
            <button
              type="button"
              className="uk-button uk-button-default edit-tab-cancel"
              disabled={saving}
              onClick={onCancel}
            >
              {chrome.i18n.getMessage('content_msg_edit_tab_cancel')}
            </button>
            <button
              type="submit"
              className="uk-button uk-button-primary uk-margin-small-left edit-tab-save"
              disabled={saving || blocked}
            >
              {chrome.i18n.getMessage(
                adding
                  ? 'content_msg_add_tab_save'
                  : 'content_msg_edit_tab_save',
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTabModal;

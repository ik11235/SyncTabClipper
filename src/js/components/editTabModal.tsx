import React, { useEffect, useId, useState } from 'react';
import { model } from '../types/interface';
import { util } from '../util';

interface EditTabModalProps {
  tab: model.Tab;
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
  const headingId = useId();
  const titleFieldId = useId();
  const urlFieldId = useId();
  const onCancel = props.onCancel;

  // 保存中に閉じられると、書き込みの結果を受け取る相手がいなくなる。
  // 「キャンセルしたのに保存されていた」「後から着地した保存が次に開いた
  // モーダルを閉じる」といった状態を作らないため、保存中はEscもキャンセルも
  // 効かせない（storage.syncの書き込みは必ず成功か失敗で決着する）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !saving) {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, saving]);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const newTitle = title.trim();
    const newUrl = url.trim();
    // titleが空だとリンクの文字が消えてクリックできなくなる
    if (newTitle.length <= 0) {
      setError(chrome.i18n.getMessage('content_msg_edit_tab_title_required'));
      return;
    }
    // URLとして解釈できない文字列を弾く。スキームまでは見ないため、
    // これを通っても開けるURLとは限らない
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
    >
      <div className="uk-modal-dialog uk-modal-body">
        <h2 className="uk-modal-title" id={headingId}>
          {chrome.i18n.getMessage('content_msg_edit_tab_heading')}
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
              disabled={saving}
            >
              {chrome.i18n.getMessage('content_msg_edit_tab_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTabModal;

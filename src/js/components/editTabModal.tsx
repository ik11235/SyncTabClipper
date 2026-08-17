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
export const EditTabModal: React.FC<EditTabModalProps> = (props) => {
  const [title, setTitle] = useState(props.tab.title);
  const [url, setUrl] = useState(props.tab.url);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const headingId = useId();
  const titleFieldId = useId();
  const urlFieldId = useId();
  const onCancel = props.onCancel;

  // 保存中にEscで閉じると、保存が成功したのかどうかを確認できないまま
  // 一覧に戻るため、保存中は閉じさせない
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
    // 開けないURLを保存すると壊れたタブが増えるため、保存前に弾く
    if (!util.isValidUrl(newUrl)) {
      setError(chrome.i18n.getMessage('content_msg_edit_tab_url_invalid'));
      return;
    }
    setError(null);
    setSaving(true);
    props.onSave({ title: newTitle, url: newUrl }).catch(() => {
      // 失敗の詳細はApp側がerrorLogへ記録し、ErrorDisplayが表示する。
      // ここでは入力を残したまま再試行できる状態に戻す
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
          {/* 入力の直後にエラーを置き、どこを直せばよいか分かるようにする */}
          {error != null ? (
            <p className="uk-text-danger edit-tab-error">{error}</p>
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

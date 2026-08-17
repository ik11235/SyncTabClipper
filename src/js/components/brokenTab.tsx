import React from 'react';

interface BrokenTabProps {
  deleteClick: VoidFunction;
  // ロック中のブロックでは削除もできない。壊れたタブを消すにはロックを解除する
  locked: boolean;
}

// 描画できなかったタブ1件の代わりに表示する行。
// 同じブロックの他のタブを巻き添えにしないための差し替え先で、
// 削除だけはできるようにする
const BrokenTab: React.FC<BrokenTabProps> = (props) => {
  return (
    <li className="tab-root-dom broken-tab-root-dom">
      <span>{chrome.i18n.getMessage('content_msg_broken_tab')}</span>
      <span
        className={`tab_close broken_tab_close ${
          props.locked ? 'tab-action-disabled' : 'uk-link'
        }`}
        data-uk-icon="icon: close; ratio: 0.9"
        role="button"
        title={chrome.i18n.getMessage(
          props.locked
            ? 'content_msg_locked_action_disabled'
            : 'content_msg_delete_tab',
        )}
        aria-label={chrome.i18n.getMessage(
          props.locked
            ? 'content_msg_locked_action_disabled'
            : 'content_msg_delete_tab',
        )}
        aria-disabled={props.locked}
        onClick={props.locked ? undefined : props.deleteClick}
      />
    </li>
  );
};

export default BrokenTab;

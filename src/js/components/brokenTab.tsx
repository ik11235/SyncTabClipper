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
      {/* classNameはロック中も変えない（UIkitが付けるuk-iconごと
          Reactに書き換えられ、アイコンの見た目が戻らなくなるため）。
          無効の見た目はaria-disabledを見てCSS側で付ける */}
      <span
        className="uk-link tab_close broken_tab_close"
        data-uk-icon="icon: close; ratio: 0.9"
        title={
          props.locked
            ? chrome.i18n.getMessage('content_msg_locked_action_disabled')
            : chrome.i18n.getMessage('content_msg_delete_tab')
        }
        aria-disabled={props.locked}
        onClick={props.locked ? undefined : props.deleteClick}
      />
    </li>
  );
};

export default BrokenTab;

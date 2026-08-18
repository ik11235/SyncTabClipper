import { model } from '../types/interface';
import React from 'react';
import { util } from '../util';

interface TabProps {
  tab: model.Tab;
  deleteClick: VoidFunction;
  editClick: VoidFunction;
  openLinkClick: VoidFunction;
  // ロック中のブロックのタブは編集・削除できない。
  // リンクを開く導線は残す（開いても一覧から消さないのはBlock側の判断）
  locked: boolean;
}

/**
 * 開けるタブかを判定する。urlが空のタブ（chrome.tabs.Tab.urlは
 * コミット前のタブで空文字列になりうる）はchrome.tabs.createに渡せない。
 * 開く導線（リンク・すべてのリンクを開く）で判断を揃えるためここに置く
 * @param {model.Tab} tab 判定するタブ
 * @return {boolean} 開けるタブならtrue
 */
export const openableTab = (tab: model.Tab): boolean => Boolean(tab?.url);

export const Tab: React.FC<TabProps> = (props) => {
  const domain = util.getDomain(props.tab.url);
  const encodeDomain = domain === '' ? encodeURI(' ') : encodeURI(domain);

  return (
    <li className="tab-root-dom">
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeDomain}`}
        alt={props.tab.title}
      />
      {/* 開けないタブをリンクにすると、クリックで空の新規タブが開いたうえで
          タブが一覧から消える。titleは読めるのでテキストとしては表示する */}
      {openableTab(props.tab) ? (
        <a
          href={props.tab.url}
          className="tab_link"
          data-url={props.tab.url}
          data-title={props.tab.title}
          onClick={(e) => {
            e.preventDefault();
            props.openLinkClick();
          }}
        >
          {props.tab.title}
        </a>
      ) : (
        <span className="tab_title" data-title={props.tab.title}>
          {props.tab.title}
        </span>
      )}
      {/* アイコンだけでは何のボタンか分からないためtitleで補う。
          urlが空のタブもここから修復できるよう、開けるかに関わらず出す。
          ロック中はアイコンを消さずに無効化する。消すと行のレイアウトが
          変わってロックを解除するまで何ができなくなったのか分からない。
          classNameはロック中も変えない。UIkitがdata-uk-iconの初期化時に
          付けるuk-iconクラスごとReactが書き換えてしまい、
          data-uk-iconの変化しか見ていないUIkitはもう付け直さないため
          （アイコンの色と行の高さが崩れたままリロードまで戻らない）。
          無効の見た目はaria-disabledを見てCSS側で付ける */}
      <span
        className="uk-link tab_edit"
        data-uk-icon="icon: pencil; ratio: 0.9"
        // 押せない理由はtitleで補い、名前（アクセシブル名）は状態で変えない。
        // 差し替えると編集と削除が同じ名前になり、どちらか区別できなくなる
        title={
          props.locked
            ? chrome.i18n.getMessage('content_msg_locked_action_disabled')
            : chrome.i18n.getMessage('content_msg_edit_tab')
        }
        aria-label={chrome.i18n.getMessage('content_msg_edit_tab')}
        aria-disabled={props.locked}
        onClick={props.locked ? undefined : props.editClick}
      />
      <span
        className="uk-link tab_close"
        data-uk-icon="icon: close; ratio: 0.9"
        title={
          props.locked
            ? chrome.i18n.getMessage('content_msg_locked_action_disabled')
            : chrome.i18n.getMessage('content_msg_delete_tab')
        }
        aria-label={chrome.i18n.getMessage('content_msg_delete_tab')}
        aria-disabled={props.locked}
        onClick={props.locked ? undefined : props.deleteClick}
      />
    </li>
  );
};

export default Tab;

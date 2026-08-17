import { model } from '../types/interface';
import React from 'react';
import { util } from '../util';

interface TabProps {
  tab: model.Tab;
  deleteClick: VoidFunction;
  editClick: VoidFunction;
  openLinkClick: VoidFunction;
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
          urlが空のタブもここから修復できるよう、開けるかに関わらず出す */}
      <span
        className="uk-link tab_edit"
        data-uk-icon="icon: pencil; ratio: 0.9"
        title={chrome.i18n.getMessage('content_msg_edit_tab')}
        onClick={props.editClick}
      />
      <span
        className="uk-link tab_close"
        data-uk-icon="icon: close; ratio: 0.9"
        onClick={props.deleteClick}
      />
    </li>
  );
};

export default Tab;

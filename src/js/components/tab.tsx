import { model } from '../types/interface';
import React from 'react';
import { util } from '../util';

interface TabProps {
  tab: model.Tab;
  deleteClick: VoidFunction;
  openLinkClick: VoidFunction;
}

export const Tab: React.FC<TabProps> = (props) => {
  const domain = util.getDomain(props.tab.url);
  const encodeDomain = domain === '' ? encodeURI(' ') : encodeURI(domain);
  const encodeUrl = util.escapeHtml(props.tab.url);
  const encodeTitle = util.escapeHtml(props.tab.title);

  return (
    <li className="tab-root-dom">
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeDomain}`}
        alt={encodeTitle}
      />
      <a
        href={encodeUrl}
        className="tab_link"
        data-url={encodeUrl}
        data-title={encodeTitle}
        onClick={(e) => {
          e.preventDefault();
          props.openLinkClick();
        }}
      >
        {encodeTitle}
      </a>
      <span
        className="uk-link tab_close"
        data-uk-icon="icon: close; ratio: 0.9"
        onClick={props.deleteClick}
      />
    </li>
  );
};

export default Tab;

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

  return (
    <li className="tab-root-dom">
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeDomain}`}
        alt={props.tab.title}
      />
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
      <span
        className="uk-link tab_close"
        data-uk-icon="icon: close; ratio: 0.9"
        onClick={props.deleteClick}
      />
    </li>
  );
};

export default Tab;

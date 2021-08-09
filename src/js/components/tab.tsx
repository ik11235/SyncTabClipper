import {model} from "../types/interface";
import React from "react";
import {util} from "../util";

interface TabProps {
    tab: model.Tab,
    deleteClick: VoidFunction,
    openLinkClick: VoidFunction,
}

export const Tab: React.FC<TabProps> = (props) => {
    const domain = util.getDomain(props.tab.url);
    const encode_domain = (domain === "") ? encodeURI(" ") : encodeURI(domain);
    const encode_url = util.escape_html(props.tab.url);
    const encode_title = util.escape_html(props.tab.title);

    return (
        <li className="tab-root-dom">
            <img src={`https://www.google.com/s2/favicons?domain=${encode_domain}`} alt={encode_title}/>
            <a href={encode_url} className="tab_link" data-url={encode_url}
               data-title={encode_title} onClick={(e) => {
                e.preventDefault();
                props.openLinkClick();
            }}>{encode_title}</a>
            <span className="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"
                  onClick={props.deleteClick}/>
        </li>
    );
};

export default Tab;
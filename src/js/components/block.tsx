import React, {useState} from 'react';
import {model} from "../types/interface";
import {util} from "../util";

interface MainProps {
    BlockAndKeys: model.BlockAndKey[]
}

const Main: React.FC<MainProps> = (props) => {

    if (props.BlockAndKeys.length > 0) {
        return (
            <div>
                {props.BlockAndKeys.map((block) => {
                    return BlockDom(block)
                })}
            </div>
        );
    } else {
        return (
            <div className="uk-header">
                <h3 className="uk-title uk-margin-remove-bottom no-tabs">保存済みのタブはありません。</h3>
            </div>
        );
    }
};

export const MainDom = (blocks: model.BlockAndKey[]) => <Main BlockAndKeys={blocks}/>;


const Block: React.FC<model.BlockAndKey> = (block) => {
    const created_at = block.block.created_at;

    return (
        <div id={block.IDkey} className="tabs uk-card-default block-root-dom" data-created-at="${created_at.getTime()}">
            <div className="uk-card-header">
                <h3 className="uk-card-title uk-margin-remove-bottom">{block.block.tabs.length}個のタブ</h3>
                <p className="uk-text-meta uk-margin-remove-top">作成日: <time
                    dateTime={created_at.toISOString()}>${created_at.toISOString()}</time></p>
                <div className="uk-grid">
                    <div className="uk-width-auto"><span className="all_tab_link uk-link">すべてのリンクを開く</span></div>
                    <div className="uk-width-auto"><span className="all_tab_delete uk-link">すべてのリンクを閉じる</span></div>
                    <div className="uk-width-expand"></div>
                </div>
            </div>
            <div className="uk-card-body">
                <ul>
                    {block.block.tabs.map((tab) => {
                        return TabDom(tab);
                    })}
                </ul>
            </div>
        </div>
    );
};

export const BlockDom = (block: model.BlockAndKey) => <Block block={block.block} IDkey={block.IDkey}/>;

const Tab: React.FC<model.Tab> = (tab) => {
        const [nowTab, setNowTab] = useState(tab);
        const [isDisplayed, setIsDisplayed] = useState(true);

        const deleteTab = () => {
            setIsDisplayed(false)
        }

        if (isDisplayed) {
            const domain = util.getDomain(nowTab.url);
            const encode_domain = (domain === "") ? encodeURI(" ") : encodeURI(domain);
            const encode_url = util.escape_html(tab.url);
            const encode_title = util.escape_html(tab.title);


            return (
                <li className="tab-root-dom">
                    <img src={`https://www.google.com/s2/favicons?domain=${encode_domain}`} alt={encode_title}/>
                    <a href={encode_url} className="tab_link" data-url={encode_url}
                       data-title={encode_title}>{encode_title}</a>
                    <span className="uk-link tab_close" uk-icon="icon: close; ratio: 0.9" onClick={deleteTab}/>
                </li>
            );
        } else {
            return (<div style={display_none}/>);
        }
    }
;

const display_none = {
    display: "none"
};


export const TabDom = (tab: model.Tab) => <Tab url={tab.url} title={tab.title}/>;

export default Block;

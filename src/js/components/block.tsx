import React, {useState} from 'react';
import {model} from "../types/interface";
import {util} from "../util";
import {chromeService} from "../chromeService";

interface MainProps {
    Block: model.NewBlock[]
}

const Main: React.FC<MainProps> = (props) => {
    if (props.Block.length > 0) {
        return (
            <div>
                {props.Block.map((block) => {
                    return <Block tabs={block.tabs}
                                  indexNum={block.indexNum}
                                  created_at={block.created_at}
                                  key={block.indexNum}
                    />;
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

const Block: React.FC<model.NewBlock> = (block) => {
    const [nowBlock, setNowBlock] = useState(block);
    const created_at = nowBlock.created_at;
    const openLink = (index: number) => {
        const url = nowBlock.tabs[index]!.url;
        chrome.tabs.create({url: url, active: false}, function () {
            deleteClick(index)
        });
    }

    const deleteClick = (index: number) => {
        nowBlock.tabs.splice(index, 1)
        let newBlock = {
            tabs: nowBlock.tabs,
            indexNum: nowBlock.indexNum,
            created_at: nowBlock.created_at,
        }
        chromeService.storage.setBlock(newBlock).then(_ => {
            setNowBlock(newBlock)
        })
    }

    const openAllTab = () => {
        let promiseArray: Promise<void>[] = [];
        for (let tab of nowBlock.tabs) {
            promiseArray.push(chromeService.tab.createTabs({url: tab.url, active: false}));
        }
        Promise.all(promiseArray).then(() => {
            deleteBlock();
        });
    }

    const deleteBlock = () => {
        const newBlock = {
            tabs: [],
            indexNum: nowBlock.indexNum,
            created_at: nowBlock.created_at,
        }
        chromeService.storage.setBlock(newBlock).then(_ => {
            setNowBlock(newBlock)
        })
    }

    if (nowBlock.tabs.length > 0) {
        return (
            <div className="tabs uk-card-default block-root-dom"
                 data-created-at="${created_at.getTime()}">
                <div className="uk-card-header">
                    <h3 className="uk-card-title uk-margin-remove-bottom">{nowBlock.tabs.length}個のタブ</h3>
                    <p className="uk-text-meta uk-margin-remove-top">作成日: <time
                        dateTime={created_at.toISOString()}>{created_at.toISOString()}</time></p>
                    <div className="uk-grid">
                        <div className="uk-width-auto"><span className="all_tab_link uk-link"
                                                             onClick={openAllTab}>すべてのリンクを開く</span></div>
                        <div className="uk-width-auto"><span className="all_tab_delete uk-link"
                                                             onClick={deleteBlock}>すべてのリンクを閉じる</span></div>
                        <div className="uk-width-expand"></div>
                    </div>
                </div>
                <div className="uk-card-body">
                    <ul>
                        {nowBlock.tabs.map((tab, index) => {
                            return <Tab tab={tab}
                                        deleteClick={() => deleteClick(index)}
                                        openLinkClick={() => openLink(index)}
                                        key={index}/>;
                        })}
                    </ul>
                </div>
            </div>
        );
    } else {
        return (<div style={display_none}/>);
    }
};

const display_none = {
    display: "none"
};

interface TabProps {
    tab: model.Tab,
    deleteClick: VoidFunction,
    openLinkClick: VoidFunction,
}

const Tab: React.FC<TabProps> = (props) => {
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

export default Main;

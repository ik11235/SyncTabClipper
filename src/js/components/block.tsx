import React, {useState} from 'react';
import {model} from "../types/interface";
import {chromeService} from "../chromeService";
import {Tab} from "./tab";

const Block: React.FC<model.Block> = (block) => {
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

export default Block;



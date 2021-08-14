import React, { useState } from 'react';
import { model } from '../types/interface';
import { chromeService } from '../chromeService';
import { Tab } from './tab';

interface BlockProps {
  Block: model.Block;
  deleteBlock: VoidFunction;
}

const Block: React.FC<BlockProps> = (props) => {
  const [nowBlock, setNowBlock] = useState(props.Block);
  const createdAt = nowBlock.createdAt;
  const openLink = (index: number) => {
    const url = nowBlock.tabs[index]!.url;
    chrome.tabs.create({ url: url, active: false }, function () {
      deleteClick(index);
    });
  };

  const changeBlock = (newBlock: model.Block) => {
    chromeService.storage.setBlock(newBlock).then((_) => {
      setNowBlock(newBlock);
      if (newBlock.tabs.length <= 0) {
        props.deleteBlock();
      }
    });
  };

  const deleteClick = (index: number) => {
    nowBlock.tabs.splice(index, 1);
    const newBlock = {
      tabs: nowBlock.tabs,
      indexNum: nowBlock.indexNum,
      createdAt: nowBlock.createdAt,
    };
    changeBlock(newBlock);
  };

  const openAllTab = () => {
    const promiseArray: Promise<void>[] = [];
    for (const tab of nowBlock.tabs) {
      promiseArray.push(
        chromeService.tab.createTabs({ url: tab.url, active: false })
      );
    }
    Promise.all(promiseArray).then(() => {
      deleteBlock();
    });
  };

  const deleteBlock = () => {
    const newBlock = {
      tabs: [],
      indexNum: nowBlock.indexNum,
      createdAt: nowBlock.createdAt,
    };
    changeBlock(newBlock);
  };

  return (
    <div
      className="tabs uk-card-default block-root-dom"
      data-created-at="${created_at.getTime()}"
    >
      <div className="uk-card-header">
        <h3 className="uk-card-title uk-margin-remove-bottom">
          {chrome.i18n.getMessage('content_msg_tab_length', [
            nowBlock.tabs.length,
          ])}
        </h3>
        <p className="uk-text-meta uk-margin-remove-top">
          {chrome.i18n.getMessage('content_msg_created_at')}
          <time dateTime={createdAt.toISOString()}>
            {createdAt.toLocaleString()}
          </time>
        </p>
        <div className="uk-grid">
          <div className="uk-width-auto">
            <span className="all_tab_link uk-link" onClick={openAllTab}>
              {chrome.i18n.getMessage('content_msg_all_tab_open')}
            </span>
          </div>
          <div className="uk-width-auto">
            <span className="all_tab_delete uk-link" onClick={deleteBlock}>
              {chrome.i18n.getMessage('content_msg_all_tab_close')}
            </span>
          </div>
          <div className="uk-width-expand" />
        </div>
      </div>
      <div className="uk-card-body">
        <ul>
          {nowBlock.tabs.map((tab, index) => {
            return (
              <Tab
                tab={tab}
                deleteClick={() => deleteClick(index)}
                openLinkClick={() => openLink(index)}
                key={index}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Block;

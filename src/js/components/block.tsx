import React from 'react';
import { model } from '../types/interface';
import { chromeService } from '../chromeService';
import { Tab } from './tab';

interface BlockProps {
  block: model.Block;
  // storageへの永続化とブロック一覧stateの更新はApp側で行う
  updateBlock: (newBlock: model.Block) => void;
}

// ブロックのstateはAppが所有し、Blockはpropsの表示と操作イベントの発火に徹する。
// memo化により、他ブロック更新時の再レンダリングを避ける
// （updateBlockはApp側でuseCallbackにより参照が安定している前提）
const Block: React.FC<BlockProps> = React.memo((props) => {
  const block = props.block;
  const createdAt = block.createdAt;

  const openLink = (index: number) => {
    const url = block.tabs[index]!.url;
    chromeService.tab
      .createTabs({ url: url, active: false })
      .then(() => deleteClick(index))
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  };

  const deleteClick = (index: number) => {
    props.updateBlock({
      tabs: block.tabs.filter((_, i) => i != index),
      indexNum: block.indexNum,
      createdAt: block.createdAt,
    });
  };

  const openAllTab = () => {
    const promiseArray: Promise<void>[] = [];
    for (const tab of block.tabs) {
      promiseArray.push(
        chromeService.tab.createTabs({ url: tab.url, active: false }),
      );
    }
    Promise.all(promiseArray)
      .then(() => {
        deleteBlock();
      })
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  };

  const deleteBlock = () => {
    props.updateBlock({
      tabs: [],
      indexNum: block.indexNum,
      createdAt: block.createdAt,
    });
  };

  return (
    <div className="tabs uk-card-default block-root-dom">
      <div className="uk-card-header">
        <h3 className="uk-card-title uk-margin-remove-bottom">
          {chrome.i18n.getMessage('content_msg_tab_length', [
            block.tabs.length,
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
          {block.tabs.map((tab, index) => {
            return (
              <Tab
                tab={tab}
                deleteClick={() => deleteClick(index)}
                openLinkClick={() => openLink(index)}
                key={`${tab.url}-${index}`}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
});

Block.displayName = 'Block';

export default Block;

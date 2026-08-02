import { model } from '../types/interface';
import React from 'react';
import Block from './block';

interface MainProps {
  blocks: model.Block[];
  updateBlock: (newBlock: model.Block) => void;
}

// ブロック一覧のstateはAppが所有し、Mainはpropsの表示に徹する
const Main: React.FC<MainProps> = (props) => {
  if (props.blocks.length > 0) {
    return (
      <div>
        {props.blocks.map((block) => {
          return (
            <Block
              key={block.indexNum}
              block={block}
              updateBlock={props.updateBlock}
            />
          );
        })}
      </div>
    );
  } else {
    return (
      <div className="uk-header">
        <h3 className="uk-title uk-margin-remove-bottom no-tabs">
          {chrome.i18n.getMessage('content_msg_not_tab')}
        </h3>
      </div>
    );
  }
};
export default Main;

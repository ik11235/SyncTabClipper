import { model } from '../types/interface';
import React, { useState } from 'react';
import Block from './block';

interface MainProps {
  Block: model.Block[];
}

const Main: React.FC<MainProps> = (props) => {
  const [nowBlocks, setNowBlocks] = useState(props.Block);

  const deleteBlock = (index: number) => {
    setNowBlocks((blocks) => {
      return blocks.filter((block) => block.indexNum != index);
    });
  };

  if (nowBlocks.length > 0) {
    return (
      <div>
        {nowBlocks.map((block, index) => {
          return (
            <Block
              key={block.indexNum}
              Block={block}
              deleteBlock={() => deleteBlock(block.indexNum)}
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

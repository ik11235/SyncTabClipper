import React from 'react';

interface BrokenBlockProps {
  indexNum: number;
  // storageからの削除とブロック一覧stateの更新はApp側で行う
  deleteBlock: (indexNum: number) => void;
}

// 復元も描画もできなかったブロックのカード。
// 一覧から黙って消すとユーザーが手出しできなくなるため、
// 読み込めなかったことを示して削除導線だけを提供する
const BrokenBlock: React.FC<BrokenBlockProps> = (props) => {
  return (
    <div className="tabs uk-card-default block-root-dom broken-block-root-dom">
      <div className="uk-card-header">
        <h3 className="uk-card-title uk-margin-remove-bottom">
          {chrome.i18n.getMessage('content_msg_broken_block')}
        </h3>
        <div className="uk-grid">
          <div className="uk-width-auto">
            <span
              className="broken_block_delete uk-link"
              onClick={() => props.deleteBlock(props.indexNum)}
            >
              {chrome.i18n.getMessage('content_msg_broken_block_delete')}
            </span>
          </div>
          <div className="uk-width-expand" />
        </div>
      </div>
    </div>
  );
};

export default BrokenBlock;

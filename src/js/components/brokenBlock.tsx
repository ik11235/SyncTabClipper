import React from 'react';

interface BrokenBlockProps {
  indexNum: number;
  // この拡張機能が知らないスキーマ版数のデータか（削除導線を出さない）
  unsupported: boolean;
  // storageからの削除とブロック一覧stateの更新はApp側で行う
  deleteBlock: (indexNum: number) => void;
}

// 復元も描画もできなかったブロックのカード。
// 一覧から黙って消すとユーザーが手出しできなくなるため、
// 読み込めなかったことを示して削除導線だけを提供する。
// ただし新しいバージョンで保存されただけのデータは実データが生きているので、
// 削除（＝全同期端末からの消去）へ誘導しない
const BrokenBlock: React.FC<BrokenBlockProps> = (props) => {
  return (
    <div className="tabs uk-card-default block-root-dom">
      <div className="uk-card-header">
        <h3 className="uk-card-title uk-margin-remove-bottom">
          {props.unsupported
            ? chrome.i18n.getMessage('content_msg_unsupported_block')
            : chrome.i18n.getMessage('content_msg_broken_block')}
        </h3>
        {props.unsupported ? null : (
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
        )}
      </div>
    </div>
  );
};

export default BrokenBlock;

import React from 'react';

interface BrokenBlockProps {
  indexNum: number;
  // この拡張機能が知らないスキーマ版数のデータか（削除前に警告する）
  unsupported: boolean;
  // 編集をロックしていたブロックか。描画に失敗するとロックを解除する導線ごと
  // 失われるため、削除させないのではなく警告して委ねる
  locked: boolean;
  // storageからの削除とブロック一覧stateの更新はApp側で行う
  deleteBlock: (indexNum: number) => void;
}

// 復元も描画もできなかったブロックのカード。
// 一覧から黙って消すとユーザーが手出しできなくなるため、
// 読み込めなかったことを示して削除導線を提供する
const BrokenBlock: React.FC<BrokenBlockProps> = (props) => {
  // 削除前に警告する条件。ロックはユーザーが明示的に付けた保護なので、
  // 版数が読めないことより優先して伝える
  const confirmMessageKey = props.locked
    ? 'content_msg_locked_block_delete_confirm'
    : props.unsupported
      ? 'content_msg_unsupported_block_delete_confirm'
      : null;

  const deleteBlock = () => {
    // 新しいバージョンで保存されただけのデータは実データが生きている可能性があり、
    // 削除するとすべての同期端末から消える。ただし削除させないと
    // 「すべてのデータを削除」以外に消す手段がなくなるため、警告して委ねる
    if (
      confirmMessageKey != null &&
      !window.confirm(chrome.i18n.getMessage(confirmMessageKey))
    ) {
      return;
    }
    props.deleteBlock(props.indexNum);
  };

  return (
    <div
      className="tabs uk-card-default block-root-dom"
      // 位置の追跡から漏れると、他のカードが動いたときに取り残される
      data-block-index={props.indexNum}
    >
      <div className="uk-card-header">
        <h3 className="uk-card-title uk-margin-remove-bottom">
          {props.unsupported
            ? chrome.i18n.getMessage('content_msg_unsupported_block')
            : chrome.i18n.getMessage('content_msg_broken_block')}
        </h3>
        <div className="uk-grid">
          <div className="uk-width-auto">
            <span className="broken_block_delete uk-link" onClick={deleteBlock}>
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

import { model } from '../types/interface';
import React from 'react';
import { blockService } from '../blockService';
import Block from './block';
import BrokenBlock from './brokenBlock';
import { ErrorBoundary } from './errorBoundary';
import { useBlockMoveAnimation } from './useBlockMoveAnimation';

interface MainProps {
  blocks: model.BlockEntry[];
  // 直前の更新が他のtabsページ・他端末の変更（storageの読み直し）由来か
  fromStorage: boolean;
  updateBlock: (newBlock: model.Block) => Promise<void>;
  deleteBrokenBlock: (indexNum: number) => void;
}

// ブロック一覧のstateはAppが所有し、Mainはpropsの表示に徹する
const Main: React.FC<MainProps> = (props) => {
  // 並び替えでカードが動いたことを見せるのはこのフックが担う。
  // 外から降ってきた変更では画面を動かさない（読んでいた位置が飛ぶ）
  const listRoot = useBlockMoveAnimation(props.blocks, !props.fromStorage);

  if (props.blocks.length > 0) {
    return (
      <div ref={listRoot}>
        {props.blocks.map((entry) =>
          blockService.isBrokenBlock(entry) ? (
            <BrokenBlock
              key={entry.indexNum}
              indexNum={entry.indexNum}
              unsupported={entry.unsupported}
              // 復元できなかったブロックはロックしていたかも分からない
              locked={false}
              deleteBlock={props.deleteBrokenBlock}
            />
          ) : (
            // 壊れたデータ1件のレンダリング時例外で一覧全体が失われないよう、
            // ブロック単位で境界を置く。落ちたブロックは
            // 復元できなかったブロックと同じ削除できるカードに差し替える
            <ErrorBoundary
              key={entry.indexNum}
              // 読み直しで同じ位置のブロックが差し替わったら表示をやり直す。
              // 参照が変わるのは中身が読み直されたブロックだけなので、
              // 落ちていない兄弟の編集中モーダルや入力を巻き込まない
              resetKey={entry}
              fallback={
                <BrokenBlock
                  indexNum={entry.indexNum}
                  unsupported={false}
                  // 描画に失敗するとロックを解除する導線ごと失われるため、
                  // ロックしていたことを削除前の警告として引き継ぐ
                  locked={entry.locked === true}
                  deleteBlock={props.deleteBrokenBlock}
                />
              }
            >
              <Block block={entry} updateBlock={props.updateBlock} />
            </ErrorBoundary>
          ),
        )}
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

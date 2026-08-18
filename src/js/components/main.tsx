import { model } from '../types/interface';
import React from 'react';
import { blockService } from '../blockService';
import Block from './block';
import BrokenBlock from './brokenBlock';
import { ErrorBoundary } from './errorBoundary';

interface MainProps {
  blocks: model.BlockEntry[];
  updateBlock: (newBlock: model.Block) => Promise<void>;
  deleteBrokenBlock: (indexNum: number) => void;
}

// ブロック一覧のstateはAppが所有し、Mainはpropsの表示に徹する
const Main: React.FC<MainProps> = (props) => {
  if (props.blocks.length > 0) {
    return (
      <div>
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

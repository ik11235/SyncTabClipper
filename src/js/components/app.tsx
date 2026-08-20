import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { model } from '../types/interface';
import { blockService } from '../blockService';
import { chromeService } from '../chromeService';
import Header from './header';
import { ErrorDisplay } from './error';
import { ErrorBoundary } from './errorBoundary';
import Main from './main';
import SideBar from './sideBar';

const App: React.FC = () => {
  // chrome.storageを単一の情報源とし、その読み込み結果をAppが所有する。
  // Main/Blockはpropsの表示に徹する（nullはロード中を表す）
  const [blocks, setBlocks] = useState<model.BlockEntry[] | null>(null);

  useEffect(() => {
    chromeService.storage
      .getAllBlock()
      .then(setBlocks)
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  }, []);

  // ブロックの変更をstorageへ永続化し、成功時のみstateへ反映する。
  // タブが空になったブロックはstorage側で削除されるため一覧からも除く。
  // React.memo化したBlockの再レンダリングを防ぐため参照を安定させる。
  // 失敗はerrorLogに記録したうえで、呼び出し側が結果に応じてUIを制御できる
  // （編集モーダルを閉じない等）よう再throwする
  const updateBlock = useCallback(
    (newBlock: model.Block): Promise<void> =>
      chromeService.storage
        .setBlock(newBlock)
        .then(() => {
          setBlocks((prevBlocks) => {
            if (prevBlocks == null) {
              return prevBlocks;
            }
            if (newBlock.tabs.length <= 0) {
              return prevBlocks.filter(
                (block) => block.indexNum != newBlock.indexNum,
              );
            }
            return prevBlocks.map((block) =>
              block.indexNum == newBlock.indexNum ? newBlock : block,
            );
          });
        })
        .catch((error) => {
          chromeService.errorLog.set(error).catch(console.error);
          throw error;
        }),
    [],
  );

  // 復元・描画できなかったブロックはmodel.Blockを作れないため、
  // indexNumだけを渡してstorageから削除する
  const deleteBrokenBlock = useCallback((indexNum: number) => {
    chromeService.storage
      .removeBlock(indexNum)
      .then(() => {
        setBlocks((prevBlocks) => {
          if (prevBlocks == null) {
            return prevBlocks;
          }
          return prevBlocks.filter((block) => block.indexNum != indexNum);
        });
      })
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  }, []);

  // 一覧の並びはstorageから読み込んだ時点でも整えているが、スターの付け外しは
  // 並び順そのものを変えるため、state側でも同じ規則で並べ直す。
  // updateBlockは要素を同じ位置に差し替えるだけなので、これがないと
  // お気に入りにしたブロックがリロードするまで先頭に来ない
  const sortedBlocks = useMemo(
    () => blocks?.toSorted(blockService.compareBlockEntry) ?? null,
    [blocks],
  );

  // 全データ削除をstorageへ反映し、成功時のみ一覧を空にする。
  // 完了通知（alert）はUIを持つSideBar側で行うためPromiseを返す
  const deleteAllBlocks = useCallback(
    (): Promise<void> =>
      chromeService.storage.allClear().then(() => {
        setBlocks([]);
      }),
    [],
  );

  return (
    <div className="uk-container">
      <div className="uk-grid">
        <div className="uk-width-1-1">
          <Header />
        </div>
      </div>

      {/* エラー表示はブロック読み込みの成否に依存させず常にレンダリングする */}
      <div className="uk-grid">
        <div className="uk-width-1-1">
          <ErrorDisplay />
        </div>
      </div>

      <div className="uk-grid">
        <div className="uk-width-expand">
          {/* Mainのレンダリング時例外でHeader/ErrorDisplay/SideBarまで
              アンマウントされないよう境界で隔離する（旧・独立ルート構成が
              持っていたフォールトアイソレーションの維持） */}
          <ErrorBoundary>
            {/* ロード中に「保存済みタブなし」を誤表示しないよう
                ロード完了までMainをマウントしない */}
            {sortedBlocks != null ? (
              <Main
                blocks={sortedBlocks}
                updateBlock={updateBlock}
                deleteBrokenBlock={deleteBrokenBlock}
              />
            ) : null}
          </ErrorBoundary>
        </div>
        <SideBar deleteAllBlocks={deleteAllBlocks} />
      </div>
    </div>
  );
};

export default App;

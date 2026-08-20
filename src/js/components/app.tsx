import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

  // 直前の更新がstorageの読み直しによるものか。インポートやタブ操作は
  // ブロック1件ごとにstorageを書くため、読み直しは短時間に何度も走る。
  // 「自分の操作で並び替わった」ことを前提に画面を動かす演出
  // (useBlockMoveAnimation)を、外から降ってきた変更で動かさないための印
  const [fromStorage, setFromStorage] = useState(false);

  // 読み直しが飛行中か。並行して走らせると、先に始まった読み込みが後から
  // 着地して古い一覧に戻す。1件ずつ書き込むインポートでは全件の読み直しが
  // 書き込みの回数だけ重なるため、飛行中の変更は1回に畳んで待たせる
  const reloading = useRef(false);
  const reloadQueued = useRef(false);

  const reload = useCallback((): void => {
    if (reloading.current) {
      reloadQueued.current = true;
      return;
    }
    reloading.current = true;
    const run = (): void => {
      chromeService.storage
        .getAllBlock()
        .then((entries) => {
          setBlocks(entries);
          setFromStorage(true);
        })
        .catch((error) => {
          chromeService.errorLog.set(error).catch(console.error);
        })
        .finally(() => {
          // 待たせていた変更は、いま読んだ内容より新しいので読み直す
          if (reloadQueued.current) {
            reloadQueued.current = false;
            run();
            return;
          }
          reloading.current = false;
        });
    };
    run();
  }, []);

  useEffect(() => {
    reload();

    // 一覧はマウント時に読んだstorageの内容を持ち続けるため、他のtabsページや
    // 他の端末(sync)での変更を知らずに書き戻すと相手の変更を消してしまう。
    // ブロックの保存データが変わったら読み直して追随する
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (
        areaName === 'sync' &&
        Object.keys(changes).some(chromeService.storage.isBlockDataKey)
      ) {
        reload();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [reload]);

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
          // この画面の操作による更新なので、並び替わったカードの移動は見せる
          setFromStorage(false);
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
        setFromStorage(false);
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
        setFromStorage(false);
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
                fromStorage={fromStorage}
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

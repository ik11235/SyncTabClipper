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

  // 書き込み時点の一覧を読むための写し。書き込みの直列化(#248)では
  // 次の書き込みが再レンダリングを待たずに走るため、stateだけを見ると
  // 直前の書き込みが反映される前の内容の上に書いてしまう。
  // レンダリング時ではなくstateを進めるのと同じタイミングで進める
  const blocksRef = useRef<model.BlockEntry[] | null>(null);
  const applyBlocks = useCallback((next: model.BlockEntry[] | null): void => {
    blocksRef.current = next;
    setBlocks(next);
  }, []);

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
          applyBlocks(entries);
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
  }, [applyBlocks]);

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

  // ブロックごとの書き込みキュー。updateBlockはブロックを丸ごと書き戻すため、
  // 同じブロックへの書き込みが並行すると後から着地した側が相手の変更を
  // 打ち消す。indexNumごとに直列化して、必ず直前の結果の上に積む
  const writeQueues = useRef(new Map<number, Promise<void>>());

  // ブロックの変更をstorageへ永続化し、成功時のみstateへ反映する。
  // 更新内容ではなく更新関数を受け取るのは、chrome.tabs.createを待つ間に
  // 一覧が変わっていても、書き込む直前の内容の上に変更を載せるため。
  // クリック時のpropsを閉じ込めたまま書き戻すと、その間に消したはずの
  // ブロックやタブが復活する。
  // タブが空になったブロックはstorage側で削除されるため一覧からも除く。
  // React.memo化したBlockの再レンダリングを防ぐため参照を安定させる。
  // 失敗はerrorLogに記録したうえで、呼び出し側が結果に応じてUIを制御できる
  // （編集モーダルを閉じない等）よう再throwする
  const enqueueWrite = useCallback(
    (indexNum: number, job: () => Promise<void>): Promise<void> => {
      const start = (): Promise<void> => {
        try {
          return job();
        } catch (error) {
          // 同期の例外のまま抜けると、キューの繋ぎ方によって
          // 呼び出し側の受け方が変わる
          return Promise.reject(error);
        }
      };
      const inFlight = writeQueues.current.get(indexNum);
      // 飛行中の書き込みがなければその場で始める。待たせるだけの
      // マイクロタスクを挟むと、書き込み中の表示（tabsWriting）が
      // 独立したレンダリングとして一瞬見えてしまう。
      // 直前の書き込みの成否に関わらず次を走らせるのは、失敗した書き込みで
      // キューを止めると以降そのブロックを操作できなくなるため
      const queued =
        inFlight == null
          ? start()
          : inFlight.catch(() => undefined).then(start);
      // 自分が最後尾のときだけ後始末する。あとから積まれていたら
      // そちらが末尾なので消さない
      const cleanup = (): void => {
        if (writeQueues.current.get(indexNum) === queued) {
          writeQueues.current.delete(indexNum);
        }
      };
      writeQueues.current.set(indexNum, queued);
      queued.then(cleanup, cleanup);
      return queued;
    },
    [],
  );

  // 飛行中の書き込みがすべて着地するまで待つ。storageを丸ごと消す前に
  // 待たないと、あとから着地した書き込みが消したはずのブロックを書き戻す
  // （updateBlockのガードは書き込みを始める前にしか効かない）。
  // 待っている間に積まれた書き込みも待つ
  const waitForWrites = useCallback(async (): Promise<void> => {
    while (writeQueues.current.size > 0) {
      await Promise.allSettled([...writeQueues.current.values()]);
    }
  }, []);

  const updateBlock = useCallback(
    (
      indexNum: number,
      update: (current: model.Block) => model.Block,
    ): Promise<void> => {
      const run = (): Promise<void> => {
        const current = blocksRef.current?.find(
          (block) => block.indexNum == indexNum,
        );
        // 待っている間に消えた／壊れたと分かったブロックには書き戻さない。
        // ここで書くと、削除済みのブロックがstorageに戻って復活する
        // 呼び出し側からは成功として見える。書けなかったことを伝えても、
        // 対象のカードはすでに一覧から外れていて見せる先がない
        if (current == null || blockService.isBrokenBlock(current)) {
          return Promise.resolve();
        }
        let newBlock: model.Block;
        try {
          newBlock = update(current);
        } catch (error) {
          // 更新関数は「もう書くべきではない」と分かったときに投げる
          // （ロックされた・編集対象が失われた）。同期の例外のまま
          // 抜けるとキューの繋ぎ方によって呼び出し側の受け方が変わる
          return Promise.reject(error);
        }
        return chromeService.storage
          .setBlock(newBlock)
          .then(() => {
            // この画面の操作による更新なので、並び替わったカードの移動は見せる
            setFromStorage(false);
            const prevBlocks = blocksRef.current;
            if (prevBlocks == null) {
              return;
            }
            applyBlocks(
              newBlock.tabs.length <= 0
                ? prevBlocks.filter(
                    (block) => block.indexNum != newBlock.indexNum,
                  )
                : prevBlocks.map((block) =>
                    block.indexNum == newBlock.indexNum ? newBlock : block,
                  ),
            );
          })
          .catch((error) => {
            chromeService.errorLog.set(error).catch(console.error);
            throw error;
          });
      };

      return enqueueWrite(indexNum, run);
    },
    [applyBlocks, enqueueWrite],
  );

  // 復元・描画できなかったブロックはmodel.Blockを作れないため、
  // indexNumだけを渡してstorageから削除する
  const deleteBrokenBlock = useCallback(
    (indexNum: number) => {
      // 同じブロックへの書き込みと並行させない。飛行中の書き込みが
      // あとから着地すると、削除したブロックがstorageに戻る
      enqueueWrite(indexNum, () =>
        chromeService.storage.removeBlock(indexNum).then(() => {
          setFromStorage(false);
          const prevBlocks = blocksRef.current;
          if (prevBlocks == null) {
            return;
          }
          applyBlocks(prevBlocks.filter((block) => block.indexNum != indexNum));
        }),
      ).catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
    },
    [applyBlocks, enqueueWrite],
  );

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
      waitForWrites().then(() =>
        chromeService.storage.allClear().then(() => {
          setFromStorage(false);
          applyBlocks([]);
        }),
      ),
    [applyBlocks, waitForWrites],
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
          {/* 一覧が読み直されたら表示をやり直す。この境界にfallbackは無く、
              一度落ちると一覧そのものが失われるため復帰の必要が最も大きい */}
          <ErrorBoundary resetKey={sortedBlocks}>
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

import React, { useEffect, useState } from 'react';
import { model } from '../types/interface';
import { chromeService } from '../chromeService';
import Header from './header';
import { ErrorDisplay } from './error';
import { ErrorBoundary } from './errorBoundary';
import Main from './main';
import SideBar from './sideBar';

const App: React.FC = () => {
  // ロード完了までMainをマウントしない（nullはロード中を表す）。
  // Mainはpropsを初期値としてstateに取り込むため、常にロード済みの
  // データでマウントされる必要がある
  const [blocks, setBlocks] = useState<model.Block[] | null>(null);

  useEffect(() => {
    chromeService.storage
      .getAllBlock()
      .then(setBlocks)
      .catch((error) => {
        chromeService.errorLog.set(error).catch(console.error);
      });
  }, []);

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
            {blocks != null && <Main Block={blocks} />}
          </ErrorBoundary>
        </div>
        <SideBar />
      </div>
    </div>
  );
};

export default App;

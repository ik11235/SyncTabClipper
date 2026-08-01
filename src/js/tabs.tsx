import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import { chromeService } from './chromeService';
import { createRoot } from 'react-dom/client';
import SideBar from './components/sideBar';
import Header from './components/header';
import React from 'react';
import Main from './components/main';
import { ErrorDisplay } from './components/error';
import '../css/uikit.min.css';

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
  const header = document.getElementById('header')!;
  createRoot(header).render(<Header />);

  // エラー表示はブロック読み込みの成否に依存させず、どの導線で開いても
  // 機能するようページ表示時点で独立してマウントする
  const errorRoot = document.getElementById('error')!;
  createRoot(errorRoot).render(<ErrorDisplay />);

  const sidebar = document.getElementById('sidebar')!;
  createRoot(sidebar).render(<SideBar />);

  chromeService.storage
    .getAllBlock()
    .then((blocks) => {
      const main = document.getElementById('main')!;

      createRoot(main).render(<Main Block={blocks} />);
    })
    .catch((error) => {
      chromeService.errorLog.set(error).catch(console.error);
    });
};

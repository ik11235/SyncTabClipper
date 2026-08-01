import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import { chromeService } from './chromeService';
import ReactDOM from 'react-dom';
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
  ReactDOM.render(<Header />, header);

  // エラー表示はブロック読み込みの成否に依存させず、どの導線で開いても
  // 機能するようページ表示時点で独立してマウントする
  const errorRoot = document.getElementById('error')!;
  ReactDOM.render(<ErrorDisplay />, errorRoot);

  const sidebar = document.getElementById('sidebar')!;
  ReactDOM.render(<SideBar />, sidebar);

  chromeService.storage
    .getAllBlock()
    .then((blocks) => {
      const main = document.getElementById('main')!;

      ReactDOM.render(<Main Block={blocks} />, main);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      chromeService.errorLog.set(message).catch(console.error);
    });
};

import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import { chromeService } from './chromeService';
import ReactDOM from 'react-dom';
import SideBar from './components/sideBar';
import Header from './components/header';
import Main from './components/main';
import { ErrorDisplay } from './components/error';
import '../css/uikit.min.css';

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
      chromeService.errorLog.set(error).catch(console.error);
    });
};

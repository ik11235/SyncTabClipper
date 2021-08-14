import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import { chromeService } from './chromeService';
import ReactDOM from 'react-dom';
import SideBar from './components/sideBar';
import Header from './components/header';
import React from 'react';
import Main from './components/main';
import '../css/uikit.min.css';

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
  const header = document.getElementById('header')!;
  ReactDOM.render(<Header />, header);

  const sidebar = document.getElementById('sidebar')!;
  ReactDOM.render(<SideBar />, sidebar);

  chromeService.storage.getAllBlock().then((blocks) => {
    const main = document.getElementById('main')!;

    ReactDOM.render(<Main Block={blocks} />, main);
  });
};

import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import {chromeService} from "./chromeService";
import ReactDOM from "react-dom";
import {MainDom} from "./components/block";
import {SideBarDom} from "./sideBar";
import {HeaderDom} from "./header";

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
  const header = document.getElementById('header')!
  ReactDOM.render(HeaderDom(), header);

  const sidebar = document.getElementById('sidebar')!
  ReactDOM.render(SideBarDom(), sidebar);

  chromeService.storage.getAllNewBlock().then(blocks => {
    const main = document.getElementById('main')!

    ReactDOM.render(MainDom(blocks), main);
  })
};

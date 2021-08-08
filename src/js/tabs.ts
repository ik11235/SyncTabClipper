import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import {blockService} from "./blockService";
import {chromeService} from "./chromeService";
import {util} from "./util"
import ReactDOM from "react-dom";
import {MainDom} from "./components/block";
import {SideBarDom} from "./sideBar";

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
  util.replacePageTitle(<HTMLElement>document.getElementsByTagName("h1")[0], chrome.runtime.getManifest().name)

  const sidebar = document.getElementById('sidebar')!
  ReactDOM.render(SideBarDom(), sidebar);

  chromeService.storage.getAllNewBlock().then(blocks => {
    const main = document.getElementById('main')!

    ReactDOM.render(MainDom(blocks), main);
  })
};

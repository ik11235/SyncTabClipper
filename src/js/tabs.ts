import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import {blockService} from "./blockService";
import {chromeService} from "./chromeService";
import {util} from "./util"
import React from "react";
import ReactDOM from "react-dom";
import App, {AppDom} from './comp';

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
  util.replacePageTitle(<HTMLElement>document.getElementsByTagName("h1")[0], chrome.runtime.getManifest().name)

  const exportJson = (): void => {
    const exportTextElement: HTMLInputElement = <HTMLInputElement>document.getElementById('export_body')
    blockService.exportAllDataJson(exportTextElement)
  }

  const importJson = (): void => {
    const importTextElement: HTMLInputElement = <HTMLInputElement>document.getElementById("import_body");
    blockService.importAllDataJson(importTextElement.value).catch(error => alert("データのインポートに失敗しました。" + error.message));
  }

  const all_clear = document.getElementById('all_clear')!
  all_clear.addEventListener('click', chromeService.storage.allClear);
  const export_link = document.getElementById('export_link')!
  export_link.addEventListener('click', exportJson);
  const import_link = document.getElementById('import_link')!
  import_link.addEventListener('click', importJson);

  chromeService.storage.getAllBlockAndKey().then(blocks => {
    const main = document.getElementById('main')!

    if (blocks.length > 0) {
      blockService.setDomForBlocks(main, blocks)
    } else {
      main.insertAdjacentHTML('afterbegin', `
<div class="uk-header">
    <h3 class="uk-title uk-margin-remove-bottom no-tabs">保存済みのタブはありません。</h3>
</div>
`);
    }
  })

  let dom = document.querySelector('#react_test');

  //@ts-ignore
  ReactDOM.render(AppDom, dom);
};

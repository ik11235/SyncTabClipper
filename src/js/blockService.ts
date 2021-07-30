import {model} from "./types/interface";
import {util} from "./util"
import {zlibWrapper} from "./zlib-wrapper";
import {chromeService} from "./chromeService";

export namespace blockService {
  export function createBlock(tabs: chrome.tabs.Tab[], created_at: Date): model.Block {
    let blockTabs: model.Tab[] = []

    tabs.forEach(tab => {
      const tab_data: model.Tab = {
        url: tab.url!,
        title: tab.title!,
      }
      blockTabs.push(tab_data);
    });

    return {
      created_at: created_at,
      tabs: blockTabs
    };
  }

  function blockToJsonObj(block: model.Block): object {
    return {
      created_at: block.created_at.getTime(),
      tabs: block.tabs
    }
  }

  function blockToJsonObjToBlock(object: any): model.Block {
    return {
      created_at: new Date(object.created_at),
      tabs: object.tabs
    }
  }

  export function blockToJson(block: model.Block): string {
    return JSON.stringify(blockToJsonObj(block));
  }

  export function jsonToBlock(json: string): model.Block {
    let js = JSON.parse(json);

    const tabs: model.Tab[] = []

    js.tabs.forEach((json_arr: any) => {
      tabs.push({
        url: json_arr.url,
        title: json_arr.title,
      });
    });

    return {
      created_at: new Date(js.created_at),
      tabs: tabs,
    }
  }

  export function inflateJson(jsonStr: string): model.Block {
    try {
      return jsonToBlock(jsonStr);
    } catch (e) {
      if (e instanceof SyntaxError) {
        const jsonStr2 = zlibWrapper.inflate(jsonStr);
        return jsonToBlock(jsonStr2);
      } else {
        throw e;
      }
    }
  }

  export function deflateBlock(block: model.Block): string {
    const blockStr = blockToJson(block)
    const deflateStr = zlibWrapper.deflate(blockStr);
    if (deflateStr.length < blockStr.length) {
      return deflateStr;
    } else {
      return blockStr;
    }
  }

  export function tabToHtml(tab: model.Tab): string {
    const domain = util.getDomain(tab.url);
    // URLパースに失敗した場合、""を返す
    // そのままだと、https://www.google.com/s2/faviconsが400になるので、空文字を渡す
    const encode_domain = (domain === "") ? encodeURI(" ") : encodeURI(domain);
    const encode_url = util.escape_html(tab.url);
    const encode_title = util.escape_html(tab.title);
    return `
<li class="tab-root-dom">
    <img src="https://www.google.com/s2/favicons?domain=${encode_domain}" alt="${encode_title}"/>
    <a href="${encode_url}" class="tab_link" data-url="${encode_url}" data-title="${encode_title}">${encode_title}</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li>`;
  }

  export function blockToHtml(block: model.Block, id: string): string {
    const created_at = block.created_at;
    const tabs = block.tabs.map(tab => tabToHtml(tab)).join("\n");
    return `
<div id="${id}" class="tabs uk-card-default block-root-dom" data-created-at="${created_at.getTime()}">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">${block.tabs.length}個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="${created_at.toISOString()}">${created_at}</time></p>
        <div class="uk-grid">
            <div class="uk-width-auto"><span class="all_tab_link uk-link">すべてのリンクを開く</span></div>
            <div class="uk-width-auto"><span class="all_tab_delete uk-link">すべてのリンクを閉じる</span></div>
            <div class="uk-width-expand"></div>
        </div>
    </div>
    <div class="uk-card-body">
        <ul>${tabs}</ul>
    </div>
</div>`;
  }

  export function htmlToBlock(htmldom: HTMLElement): model.Block {
    const meyBeCreatedAtElement = htmldom.getAttribute("data-created-at")
    if (meyBeCreatedAtElement === null) {
      throw "data-created-at is null."
    }

    const created_at = new Date(util.toNumber(meyBeCreatedAtElement))

    let tabs: model.Tab[] = []
    const linkDoms = htmldom.getElementsByClassName('tab_link')!
    for (let j = 0; j < linkDoms.length; j++) {
      const nowDom = linkDoms[j]
      if (nowDom === undefined) {
        throw "nowDom undefined."

      }
      const url = nowDom.getAttribute("data-url")
      const title = nowDom.getAttribute("data-title")
      if (url === null || title === null) {
        throw "data-url or data-title is null."
      }

      tabs.push({
        url: url,
        title: title,
      });
    }

    return {
      created_at: created_at,
      tabs: tabs
    };
  }

  const sortBlock = (a: model.Block, b: model.Block): number => {
    return b.created_at.getTime() - a.created_at.getTime()
  }

  export function exportAllDataJson(targetElement: HTMLInputElement): void {
    chromeService.storage.getAllBlock().then(blocks => {
      const sortBlocks = blocksSort(blocks);

      targetElement.value = JSON.stringify(sortBlocks.map(blockToJsonObj));
    });
  }

  function blockListForJsonObject(json: object[]): model.Block[] {
    return json.map(blockToJsonObjToBlock)
  }

  export async function importAllDataJson(jsonStr: string): Promise<void> {
    const tabLength = await chromeService.storage.getTabLength();
    let promiseArray: Promise<void>[] = [];
    let idx = tabLength;

    const json = JSON.parse(jsonStr)
    const blocks = blockListForJsonObject(json)

    blocksSort(blocks).reverse().forEach(block => {
      promiseArray.push(chromeService.storage.setTabData(idx, deflateBlock(block)))
      idx += 1
    })

    Promise.all(promiseArray).then(() => {
      chromeService.storage.setTabLength(tabLength + json.length).then(_ => {
        chrome.tabs.reload({bypassCache: true});
      }).catch(function (reason) {
        throw reason
      });
    });
  }

  export function blocksSort(blocks: model.Block[]): model.Block[] {
    return blocks.sort(sortBlock);
  }

  export function setDomForBlocks(main: HTMLElement, blockAndKeys: model.BlockAndKey[]) {
    const deleteLink = (target: HTMLElement): void => {
      const BlockRootDom = util.searchBlockRootDom(target)

      // 先にsyncに保存済みのデータを消したいがDom→JSONがやりにくくなる
      // いったん、DOM消しを先にする
      target.parentNode!.removeChild(target);

      const id = BlockRootDom.id;
      const block = blockService.htmlToBlock(BlockRootDom)
      if (block.tabs.length <= 0) {
        chrome.storage.sync.remove(id, function () {
          const error = chrome.runtime.lastError;
          if (error) {
            alert(error.message);
          }
          // タブが0になった場合、現在表示中のdomも削除する
          BlockRootDom.parentNode!.removeChild(BlockRootDom);
        });
      } else {
        let save_obj: { [key: string]: string; } = {};
        save_obj[id] = blockService.deflateBlock(block)
        chrome.storage.sync.set(save_obj, function () {
          const error = chrome.runtime.lastError;
          if (error) {
            alert(error.message);
          }
        });
      }
    }

    const clickLinkByEventListener = (e: Event): void => {
      const target = <HTMLElement>e.target!;
      const url = target.getAttribute("data-url")!
      const tabRootDom = util.searchTabRootDom(target)

      chrome.tabs.create({url: url, active: false}, function () {
        deleteLink(tabRootDom);
      });
    }

    const deleteLinkByEventListener = (e: Event): void => {
      const target = <HTMLElement>e.target!;
      const tabRootDom = util.searchTabRootDom(target)

      deleteLink(tabRootDom);
    }

    const allOpenLinkByEventListener = (e: Event): void => {
      const target = <HTMLElement>e.target!;

      const BlockRootDom = util.searchBlockRootDom(target)
      const tab_links = BlockRootDom.getElementsByClassName("tab_link");
      let promiseArray: Promise<void>[] = [];
      for (let tab of tab_links) {
        const url = tab.getAttribute("data-url")!
        promiseArray.push(chromeService.tab.createTabs({url: url, active: false}));
      }
      Promise.all(promiseArray).then(() => {
        allDeleteLink(target);
      });
    }

    const allDeleteLinkByEventListener = (e: Event): void => {
      const target = <HTMLElement>e.target!;

      allDeleteLink(target);
    }

    const allDeleteLink = (target: HTMLElement): void => {
      const BlockRootDom = util.searchBlockRootDom(target)

      const id = BlockRootDom.id;
      chrome.storage.sync.remove(id, function () {
        const error = chrome.runtime.lastError;
        if (error) {
          alert(error.message);
        }

        BlockRootDom.parentNode!.removeChild(BlockRootDom);
      });
    }

    for (const blockAndKey of blockAndKeys) {
      const block = blockAndKey.block
      const key = blockAndKey.key

      const insertHtml = blockService.blockToHtml(block, key);
      main.insertAdjacentHTML('afterbegin', insertHtml);
      const BlockRootDom = document.getElementById(key)!

      const linkDoms = BlockRootDom.getElementsByClassName('tab_link');
      for (const link of linkDoms) {
        link.addEventListener('click', function (e: Event) {
          e.preventDefault();
          clickLinkByEventListener(e);
        });
      }

      const deleteLinkDoms = BlockRootDom.getElementsByClassName('tab_close')
      for (const link of deleteLinkDoms) {
        link.addEventListener('click', deleteLinkByEventListener);
      }

      const allTabLink = BlockRootDom.getElementsByClassName('all_tab_link')[0]!
      allTabLink.addEventListener('click', allOpenLinkByEventListener)
      const allTabDelete = BlockRootDom.getElementsByClassName('all_tab_delete')[0]!
      allTabDelete.addEventListener('click', allDeleteLinkByEventListener);
    }
  }
}

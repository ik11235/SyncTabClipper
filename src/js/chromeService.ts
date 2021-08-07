import {model} from "./types/interface";
import {blockService} from "./blockService";
import {util} from "./util";

export namespace chromeService {
  export namespace storage {

    const tabLengthKey: string = "t_len";
    const tabKey = (index: number): string => `td_${index}`;

    function setSyncStorage(key: string, value: string): Promise<void> {
      let set_obj: { [key: string]: string; } = {};
      set_obj[key] = value;
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set(set_obj, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    function getSyncStorage(key: string): Promise<string> {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get([key], (item) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(error);
          } else {
            resolve(item[key]);
          }
        });
      });
    }

    export function allClear(): void {
      if (window.confirm('保存したすべてのタブを削除します。よろしいですか？')) {
        chrome.storage.sync.clear(function () {
          alert('すべてのデータを削除しました');
        });
      }
    }

    function getSyncStorageReturnKey(index: number): Promise<[string, string]> {
      const key = tabKey(index)
      return getSyncStorage(key).then(result => {
          return [key, result]
        }
      )
    }

    export async function setTabData(index: number, data: string): Promise<void> {
      const key = tabKey(index);
      return setSyncStorage(key, data);
    }

    export async function setTabLength(value: number): Promise<void> {
      return setSyncStorage(tabLengthKey, value.toString())
    }

    export async function getTabLength(): Promise<number> {
      return getSyncStorage(tabLengthKey).then(result => {
        if (result == null) {
          return 0
        } else {
          return util.toNumber(result)
        }
      })
    }

    const sortBlockAnyKeys = (a: model.BlockAndKey, b: model.BlockAndKey): number => {
      return b.block.created_at.getTime() - a.block.created_at.getTime()
    }

    export async function getAllBlock(): Promise<model.Block[]> {
      let bak = await getAllBlockAndKey()
      return bak.map(obj => obj.block)
    }

    export async function getAllBlockAndKey(): Promise<model.BlockAndKey[]> {
      let tabLength = await getTabLength()

      let promiseArray: Promise<[string, string]>[] = [];

      for (let i = 0; i < tabLength; i++) {
        promiseArray.push(getSyncStorageReturnKey(i))
      }

      return Promise.all(promiseArray).then(result => {
        const nonEmptyArr = result.filter(obj => {
          return obj[1] != null && obj[1].length > 0
        })
        let blockAnyKeys: model.BlockAndKey[] = []
        for (const arr of nonEmptyArr) {
          const t: model.BlockAndKey = {
            IDkey: arr[0],
            block: blockService.inflateJson(arr[1])
          }
          blockAnyKeys.push(t)
        }

        return blockAnyKeys.sort(sortBlockAnyKeys).reverse()
      });
    }
  }

  export namespace tab {
    export function createTabs(properties: chrome.tabs.CreateProperties): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.tabs.create(properties, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    async function closeTab(tab: chrome.tabs.Tab): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.tabs.remove(tab.id!, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    export async function closeTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
      let promiseArray: Promise<void>[] = [];

      for (const tab of tabs) {
        promiseArray.push(closeTab(tab))
      }

      try {
        await Promise.all(promiseArray)
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    export async function createTabsPageTab(): Promise<void> {
      const url = chrome.runtime.getURL('tabs.html')
      await chrome.tabs.create({
        selected: true,
        url: url,
      });
    }
  }

  export namespace ContextMenus {
    const appName = () => chrome.runtime.getManifest().name
    const parentMenuId = () => `${appName}.mainMenu`

    export function createParentMenu(): void {
      chrome.contextMenus.create({
        id: parentMenuId(),
        "title": appName(),
        "type": "normal",
        "contexts": ["all"],
      });
    }

    export function createGotoTabsPageMenu(): void {
      chrome.contextMenus.create({
        "title": "tabページを開く",
        "parentId": parentMenuId(),
        "type": "normal",
        "contexts": ["all"],
        "onclick": chromeService.tab.createTabsPageTab
      });
    }
  }
}

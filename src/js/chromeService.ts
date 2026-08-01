import { model } from './types/interface';
import { blockService } from './blockService';
import { util } from './util';

export namespace chromeService {
  export namespace storage {
    const tabLengthKey: string = 't_len';
    const tabKey = (index: number): string => `td_${index}`;

    // eslint-disable-next-line require-jsdoc
    function deleteSyncStorage(key: string): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.remove(key, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve();
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    function setSyncStorage(key: string, value: string): Promise<void> {
      const setObj: { [key: string]: string } = {};
      setObj[key] = value;
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set(setObj, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve();
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    function getSyncStorage(key: string): Promise<string> {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get([key], (item) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve(item[key] as string);
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    export async function allClear(): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.clear(function () {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve();
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    function getSyncStorageReturnIndex(
      index: number
    ): Promise<[number, string]> {
      const key = tabKey(index);
      return getSyncStorage(key).then((result) => {
        return [index, result];
      });
    }

    // eslint-disable-next-line require-jsdoc
    export async function setBlock(block: model.Block): Promise<void> {
      if (block.tabs.length <= 0) {
        return removeBlock(block);
      } else {
        return chromeService.storage.setTabData(
          block.indexNum,
          blockService.deflateBlock(block)
        );
      }
    }

    // eslint-disable-next-line require-jsdoc
    export async function removeBlock(block: model.Block): Promise<void> {
      const key = tabKey(block.indexNum);
      return deleteSyncStorage(key);
    }

    // eslint-disable-next-line require-jsdoc
    export async function setTabData(
      index: number,
      data: string
    ): Promise<void> {
      const key = tabKey(index);
      return setSyncStorage(key, data);
    }

    // eslint-disable-next-line require-jsdoc
    export async function setTabLength(value: number): Promise<void> {
      return setSyncStorage(tabLengthKey, value.toString());
    }

    // eslint-disable-next-line require-jsdoc
    export async function getTabLength(): Promise<number> {
      return getSyncStorage(tabLengthKey).then((result) => {
        if (result == null) {
          return 0;
        } else {
          return util.toNumber(result);
        }
      });
    }

    // eslint-disable-next-line require-jsdoc
    export async function getAllBlock(): Promise<model.Block[]> {
      const tabLength = await getTabLength();

      const promiseArray: Promise<[number, string]>[] = [];

      for (let i = 0; i < tabLength; i++) {
        promiseArray.push(getSyncStorageReturnIndex(i));
      }

      return Promise.all(promiseArray).then((result) => {
        const nonEmptyArr = result.filter((obj) => {
          return obj[1] != null && obj[1].length > 0;
        });
        const newBlocks: model.Block[] = [];
        for (const arr of nonEmptyArr) {
          const block = blockService.inflateJson(arr[1], arr[0]);
          newBlocks.push(block);
        }

        return newBlocks.sort(sortBlock);
      });
    }

    const sortBlock = (a: model.Block, b: model.Block): number => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    };
  }

  export namespace tab {
    // eslint-disable-next-line require-jsdoc
    export function createTabs(
      properties: chrome.tabs.CreateProperties
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.tabs.create(properties, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve();
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    async function closeTab(tab: chrome.tabs.Tab): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.tabs.remove(tab.id!, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve();
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    export async function closeTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
      const promiseArray: Promise<void>[] = [];

      for (const tab of tabs) {
        promiseArray.push(closeTab(tab));
      }

      try {
        await Promise.all(promiseArray);
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    // eslint-disable-next-line require-jsdoc
    export function queryTabs(
      queryInfo: chrome.tabs.QueryInfo
    ): Promise<chrome.tabs.Tab[]> {
      return new Promise((resolve, reject) => {
        chrome.tabs.query(queryInfo, (tabs) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve(tabs);
          }
        });
      });
    }

    // eslint-disable-next-line require-jsdoc
    export async function createTabsPageTab(): Promise<void> {
      const url = chrome.runtime.getURL('tabs.html');
      await chrome.tabs.create({
        active: true,
        url: url,
      });
    }
  }

  export namespace runtime {
    /**
     * 拡張機能自体のバージョン(manifestのversion)を返す
     * @return {string} 拡張機能のバージョン文字列
     */
    export function getExtensionVersion(): string {
      return chrome.runtime.getManifest().version;
    }
  }

  export namespace errorLog {
    export const errorKey = 'error';

    /**
     * エラーをchrome.storage.localに保存し、actionバッジで通知する。
     * service workerではalertが使えないため、tabsページのErrorDisplayが
     * このエラーを表示する。保存とバッジはユーザーがエラーを確認する
     * （可視状態のtabsページに表示される）まで残す
     * @param {unknown} error 発生したエラー（Error以外はStringで文字列化）
     * @return {Promise<void>}
     */
    export function set(error: unknown): Promise<void> {
      const message = error instanceof Error ? error.message : String(error);
      const setObj: { [key: string]: string } = {};
      setObj[errorKey] = message;
      return new Promise((resolve, reject) => {
        chrome.storage.local.set(setObj, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
          } else {
            chrome.action.setBadgeBackgroundColor({ color: '#DD2222' });
            chrome.action.setBadgeText({ text: '!' });
            resolve();
          }
        });
      });
    }

    /**
     * 保存されたエラーメッセージとバッジをクリアする
     * @return {Promise<void>}
     */
    export function clear(): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(errorKey, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            chrome.action.setBadgeText({ text: '' });
            resolve();
          }
        });
      });
    }

    /**
     * 保存されたエラーメッセージを取得する。保存とバッジはクリアしない
     * @return {Promise<string | null>} エラーメッセージ。未保存ならnull
     */
    export function get(): Promise<string | null> {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([errorKey], (item) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve((item[errorKey] as string | undefined) ?? null);
        });
      });
    }
  }

  export namespace ContextMenus {
    const appName = () => chrome.runtime.getManifest().name;
    const parentMenuId = () => `${appName()}.mainMenu`;
    export const gotoTabsPageMenuId = 'gotoTabsPage';

    // eslint-disable-next-line require-jsdoc
    export function createParentMenu(): void {
      chrome.contextMenus.create({
        id: parentMenuId(),
        title: appName(),
        type: 'normal',
        contexts: ['all'],
      });
    }

    // eslint-disable-next-line require-jsdoc
    export function createGotoTabsPageMenu(): void {
      chrome.contextMenus.create({
        id: gotoTabsPageMenuId,
        title: chrome.i18n.getMessage('content_msg_open_tab_page'),
        parentId: parentMenuId(),
        type: 'normal',
        contexts: ['all'],
      });
    }
  }
}

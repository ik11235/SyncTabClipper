import { model } from './types/interface';
import { blockService } from './blockService';
import { util } from './util';

export namespace chromeService {
  export namespace storage {
    const tabLengthKey: string = 't_len';
    const tabKey = (index: number): string => `td_${index}`;

    function deleteSyncStorage(key: string): Promise<void> {
      return chrome.storage.sync.remove(key);
    }

    function setSyncStorage(key: string, value: string): Promise<void> {
      const setObj: { [key: string]: string } = {};
      setObj[key] = value;
      return chrome.storage.sync.set(setObj);
    }

    async function getSyncStorage(key: string): Promise<string> {
      const item = await chrome.storage.sync.get([key]);
      return item[key] as string;
    }

    export async function allClear(): Promise<void> {
      return chrome.storage.sync.clear();
    }

    function getSyncStorageReturnIndex(
      index: number,
    ): Promise<[number, string]> {
      const key = tabKey(index);
      return getSyncStorage(key).then((result) => {
        return [index, result];
      });
    }

    export async function setBlock(block: model.Block): Promise<void> {
      if (block.tabs.length <= 0) {
        return removeBlock(block);
      } else {
        return chromeService.storage.setTabData(
          block.indexNum,
          blockService.deflateBlock(block),
        );
      }
    }

    export async function removeBlock(block: model.Block): Promise<void> {
      const key = tabKey(block.indexNum);
      return deleteSyncStorage(key);
    }

    export async function setTabData(
      index: number,
      data: string,
    ): Promise<void> {
      const key = tabKey(index);
      return setSyncStorage(key, data);
    }

    export async function setTabLength(value: number): Promise<void> {
      return setSyncStorage(tabLengthKey, value.toString());
    }

    export async function getTabLength(): Promise<number> {
      return getSyncStorage(tabLengthKey).then((result) => {
        if (result == null) {
          return 0;
        } else {
          return util.toNumber(result);
        }
      });
    }

    export async function getAllBlock(): Promise<model.Block[]> {
      return (await getAllBlockWithBrokenKeys()).blocks;
    }

    /**
     * 全ブロックを復元し、復元に失敗したブロックのstorage keyも併せて返す。
     * エクスポートのように「欠損したまま成功させてはいけない」呼び出し側が
     * 壊れたデータの有無を判断できるようにする
     * @return {Promise<{blocks: model.Block[], brokenKeys: string[]}>}
     */
    export async function getAllBlockWithBrokenKeys(): Promise<{
      blocks: model.Block[];
      brokenKeys: string[];
    }> {
      const tabLength = await getTabLength();

      const promiseArray: Promise<[number, string]>[] = [];

      for (let i = 0; i < tabLength; i++) {
        promiseArray.push(getSyncStorageReturnIndex(i));
      }

      const result = await Promise.all(promiseArray);
      const brokenKeys: string[] = [];
      const blocks = result
        // キー自体が存在しない場合は削除済みブロックであり、正常な状態として扱う。
        // 一方、空文字列は書き込みが壊れた形跡なのでスキップ扱いにして通知する
        .filter((obj) => obj[1] != null)
        .map((arr) => {
          // 壊れた・解釈不能な保存データが1件あっても一覧全体が
          // 表示されなくならないよう、復元失敗したブロックはスキップする
          try {
            if (arr[1].length <= 0) {
              throw new Error('Invalid block data: empty');
            }
            return blockService.inflateJson(arr[1], arr[0]);
          } catch (e) {
            console.error(`Failed to inflate block (key=${tabKey(arr[0])})`, e);
            brokenKeys.push(tabKey(arr[0]));
            return null;
          }
        })
        .filter((block) => block != null)
        .toSorted(sortBlock);

      if (brokenKeys.length > 0) {
        await notifyBrokenBlocks(brokenKeys);
      }

      return { blocks: blocks, brokenKeys: brokenKeys };
    }

    /**
     * 復元に失敗したブロックがあることをユーザーへ通知する。
     * 通知に失敗してもgetAllBlock自体は成功させる
     * @param {string[]} brokenKeys 復元に失敗したブロックのstorage key
     * @return {Promise<void>}
     */
    async function notifyBrokenBlocks(brokenKeys: string[]): Promise<void> {
      try {
        // 保存失敗など、ユーザーがまだ見ていない先行のエラーを上書きしない
        if ((await errorLog.get()) != null) {
          return;
        }
        await errorLog.set(
          chrome.i18n.getMessage('content_msg_broken_block', [
            brokenKeys.join(', '),
          ]),
        );
      } catch (e) {
        console.error(e);
      }
    }

    const sortBlock = (a: model.Block, b: model.Block): number => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    };
  }

  export namespace tab {
    export async function createTabs(
      properties: chrome.tabs.CreateProperties,
    ): Promise<void> {
      await chrome.tabs.create(properties);
    }

    async function closeTab(tab: chrome.tabs.Tab): Promise<void> {
      return chrome.tabs.remove(tab.id!);
    }

    export async function closeTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
      await Promise.all(tabs.map((tab) => closeTab(tab)));
    }

    export function queryTabs(
      queryInfo: chrome.tabs.QueryInfo,
    ): Promise<chrome.tabs.Tab[]> {
      return chrome.tabs.query(queryInfo);
    }

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
    export async function set(error: unknown): Promise<void> {
      const message = error instanceof Error ? error.message : String(error);
      const setObj: { [key: string]: string } = {};
      setObj[errorKey] = message;
      await chrome.storage.local.set(setObj);
      chrome.action.setBadgeBackgroundColor({ color: '#DD2222' });
      chrome.action.setBadgeText({ text: '!' });
    }

    /**
     * 保存されたエラーメッセージとバッジをクリアする
     * @return {Promise<void>}
     */
    export async function clear(): Promise<void> {
      await chrome.storage.local.remove(errorKey);
      chrome.action.setBadgeText({ text: '' });
    }

    /**
     * 保存されたエラーメッセージを取得する。保存とバッジはクリアしない
     * @return {Promise<string | null>} エラーメッセージ。未保存ならnull
     */
    export async function get(): Promise<string | null> {
      const item = await chrome.storage.local.get([errorKey]);
      return (item[errorKey] as string | undefined) ?? null;
    }
  }

  export namespace ContextMenus {
    const appName = () => chrome.runtime.getManifest().name;
    const parentMenuId = () => `${appName()}.mainMenu`;
    export const gotoTabsPageMenuId = 'gotoTabsPage';

    export function createParentMenu(): void {
      chrome.contextMenus.create({
        id: parentMenuId(),
        title: appName(),
        type: 'normal',
        contexts: ['all'],
      });
    }

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

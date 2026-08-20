import { model } from './types/interface';
import { blockService } from './blockService';
import { util } from './util';

export namespace chromeService {
  export namespace storage {
    const tabLengthKey: string = 't_len';
    const tabKey = (index: number): string => `td_${index}`;

    /**
     * storage.syncのキーがブロック一覧の内容に関わるものかを返す。
     * storage.onChangedの購読側が、一覧に関係のない変更で
     * 読み直さないための判定に使う
     * @param {string} key 変更されたstorageのキー
     * @return {boolean} ブロックの保存データ or ブロック数のキーならtrue
     */
    export function isBlockDataKey(key: string): boolean {
      return key === tabLengthKey || /^td_\d+$/.test(key);
    }

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
        return removeBlock(block.indexNum);
      } else {
        return chromeService.storage.setTabData(
          block.indexNum,
          await blockService.deflateBlock(block),
        );
      }
    }

    /**
     * ブロックの保存データを削除する。
     * 復元できなかったブロック（model.BrokenBlock）も削除できるよう、
     * model.Blockではなくindexだけを受け取る
     * @param {number} indexNum 削除するブロックのindex
     * @return {Promise<void>}
     */
    export async function removeBlock(indexNum: number): Promise<void> {
      const key = tabKey(indexNum);
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

    export async function getAllBlock(): Promise<model.BlockEntry[]> {
      const tabLength = await getTabLength();

      const promiseArray: Promise<[number, string]>[] = [];

      for (let i = 0; i < tabLength; i++) {
        promiseArray.push(getSyncStorageReturnIndex(i));
      }

      const result = await Promise.all(promiseArray);
      const entries = await Promise.all(
        result
          // keyが存在しないindexは削除済みのブロックなので一覧に含めない。
          // 空文字列は書き込みが壊れた形跡なのでBrokenBlockとして扱う
          .filter((obj) => obj[1] != null)
          .map((arr) => inflateEntry(arr[1], arr[0])),
      );
      return entries.toSorted(blockService.compareBlockEntry);
    }

    /**
     * 保存データ1件を復元する。復元に失敗した場合は例外を伝播させず
     * BrokenBlockを返す（1件の壊れたデータで一覧全体が失われないようにする）
     * @param {string} json 保存されていたデータ
     * @param {number} indexNum ブロックのindex
     * @return {Promise<model.BlockEntry>} 復元したBlock or BrokenBlock
     */
    async function inflateEntry(
      json: string,
      indexNum: number,
    ): Promise<model.BlockEntry> {
      try {
        if (json.length <= 0) {
          throw new Error(`Empty block data: index=${indexNum}`);
        }
        const block = await blockService.inflateJson(json, indexNum);
        if (!Array.isArray(block.tabs)) {
          // タブの配列を持たないブロックは描画もエクスポートもできない。
          // ここで弾かないと、エクスポートにtabsのないブロックが出力され
          // インポートで失敗する不完全なバックアップになる
          throw new Error(`Invalid block data: tabs is not an array`);
        }
        return block;
      } catch (e) {
        console.error(e);
        return {
          indexNum: indexNum,
          broken: true,
          unsupported: e instanceof blockService.UnsupportedVersionError,
        };
      }
    }
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

    export function tabsPageUrl(): string {
      return chrome.runtime.getURL('tabs.html');
    }

    /**
     * tabsページを開く。既に開かれているtabsページがあれば新規に開かず
     * そのタブへ切り替える。一覧はマウント時のstorageの内容を持つため、
     * 同じ端末で複数枚開かれていると古い一覧からの書き戻しで
     * 他のタブでの変更が失われる。開く枚数を1枚に寄せて頻度を下げる
     * （ユーザーが自力で複数枚開いた状態は起こりうるため、
     * その場合も残りを閉じたりはせず1枚を選んで切り替える）
     * @return {Promise<void>}
     */
    export async function createTabsPageTab(): Promise<void> {
      const url = tabsPageUrl();
      // ユーザーが複数枚開いている場合は、今見ているウィンドウのものを優先する。
      // 見えない別ウィンドウのタブへ飛ばされるより驚きが小さい
      const inCurrentWindow = await queryTabs({
        url: url,
        currentWindow: true,
      });
      const target = inCurrentWindow[0] ?? (await queryTabs({ url: url }))[0];
      if (target?.id != null) {
        await chrome.tabs.update(target.id, { active: true });
        // 別ウィンドウにあるtabsページはアクティブにしても前面に来ないため、
        // ウィンドウ自体もフォーカスする
        if (target.windowId != null) {
          await chrome.windows.update(target.windowId, { focused: true });
        }
        return;
      }
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

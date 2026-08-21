import { model } from './types/interface';
import { blockService } from './blockService';

export namespace chromeService {
  export namespace storage {
    const tabLengthKey: string = 't_len';
    const tabKey = (index: number): string => `td_${index}`;
    const tabKeyPattern = /^td_(\d+)$/;

    /**
     * storage.syncのキーがブロック一覧の内容に関わるものかを返す。
     * storage.onChangedの購読側が、一覧に関係のない変更で
     * 読み直さないための判定に使う
     * @param {string} key 変更されたstorageのキー
     * @return {boolean} ブロックの保存データ or ブロック数のキーならtrue
     */
    export function isBlockDataKey(key: string): boolean {
      return key === tabLengthKey || tabKeyPattern.test(key);
    }

    function deleteSyncStorage(key: string): Promise<void> {
      return chrome.storage.sync.remove(key);
    }

    function setSyncStorage(key: string, value: string): Promise<void> {
      const setObj: { [key: string]: string } = {};
      setObj[key] = value;
      return chrome.storage.sync.set(setObj);
    }

    export async function allClear(): Promise<void> {
      return chrome.storage.sync.clear();
    }

    /**
     * 保存されているブロックのデータを、キーの一覧から集める。
     * 件数はt_lenではなくtd_Nキーの集合そのものを単一のソースとする。
     * t_lenは採番カウンタでしかなく、削除で減らないうえに書き込み失敗で
     * 実データとずれるため、これを走査範囲にすると
     * 「t_lenが壊れると一覧が全滅する」「t_lenの外側のブロックが
     * 一覧に出ないまま次回保存で上書きされる」という取りこぼしが起きる
     * @return {Promise<[number, string][]>} [index, 保存データ]の配列
     */
    async function getAllBlockData(): Promise<[number, string][]> {
      // 個別にgetすると保存件数だけ往復するうえ、件数を先に知る必要がある。
      // nullを渡して全キーを1回で引き、td_Nだけを拾う
      const items = await chrome.storage.sync.get(null);
      const blockData: [number, string][] = [];
      for (const [key, value] of Object.entries(items)) {
        const matched = tabKeyPattern.exec(key);
        if (matched == null) {
          continue;
        }
        blockData.push([Number(matched[1]), value as string]);
      }
      return blockData;
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

    /**
     * 次に保存するブロックのindexを書き込む。
     * この拡張自身はもうt_lenを読まないが、storage.syncは複数の端末で
     * 共有されるため、まだ更新前のバージョンが動いている端末で
     * 一覧が欠けないよう書き込みだけは続ける
     * @param {number} value 次に保存するブロックのindex
     * @return {Promise<void>}
     */
    export async function setTabLength(value: number): Promise<void> {
      return setSyncStorage(tabLengthKey, value.toString());
    }

    /**
     * 次に保存するブロックに割り当てるindexを返す。
     * 保存済みのindexの最大値+1とすることで、t_lenが実データと
     * ずれていても既存のブロックを上書きしない
     * @return {Promise<number>} 未使用のindex
     */
    export async function getNextBlockIndex(): Promise<number> {
      const blockData = await getAllBlockData();
      return blockData.reduce(
        (next, [indexNum]) => Math.max(next, indexNum + 1),
        0,
      );
    }

    export async function getAllBlock(): Promise<model.BlockEntry[]> {
      const blockData = await getAllBlockData();
      const entries = await Promise.all(
        // 空文字列は書き込みが壊れた形跡なのでBrokenBlockとして扱う
        blockData.map(([indexNum, json]) => inflateEntry(json, indexNum)),
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
     * タブがtabsページかを返す。
     * 読み込みが始まったばかりのタブはurlが空でpendingUrlにだけ入るため、
     * 両方を見る（判定を漏らすと、開いたばかりのtabsページを
     * 保存対象に含めたり2枚目を開いたりする）
     * @param {chrome.tabs.Tab} tab 判定するタブ
     * @return {boolean} tabsページならtrue
     */
    export function isTabsPage(tab: chrome.tabs.Tab): boolean {
      const url = tabsPageUrl();
      return tab.url === url || tab.pendingUrl === url;
    }

    /**
     * 開かれているtabsページを探す。
     * chrome.tabs.queryのurl条件はコミット済みのURLにしか当たらず、
     * 開いた直後のtabsページを取りこぼす（連打すると2枚目が開く）ため、
     * 全タブを引いてisTabsPageで絞る
     * @return {Promise<chrome.tabs.Tab[]>} 開かれているtabsページ
     */
    async function openedTabsPages(): Promise<chrome.tabs.Tab[]> {
      const tabs = await queryTabs({});
      return tabs.filter((tab) => tab.id != null && isTabsPage(tab));
    }

    /**
     * tabsページを開く。既に開かれているtabsページがあれば新規に開かず
     * そのタブへ切り替える。
     *
     * 一覧はマウント時のstorageの内容を持つため、同じ端末で複数枚開かれて
     * いると古い一覧からの書き戻しで他のタブでの変更が失われる。開く枚数を
     * 1枚に寄せて頻度を下げる（ユーザーが自力で複数枚開いた状態は起こりうる
     * ため、その場合も残りを閉じたりはせず1枚を選んで切り替える）
     * @param {number} [adoptInto] tabsページを置いておきたいウィンドウのid。
     *   渡すと、別ウィンドウにあるtabsページをこのウィンドウへ引き取る。
     *   このウィンドウのタブをこれから閉じる呼び出し元（アイコンからの保存）が、
     *   最後のタブまで閉じてウィンドウごと消してしまうのを防ぐためのもので、
     *   何も閉じない呼び出し元（コンテキストメニュー）は渡さない
     *   （ユーザーがtabsページ専用に開いているウィンドウを空にしてしまう）
     * @return {Promise<void>}
     */
    export async function createTabsPageTab(adoptInto?: number): Promise<void> {
      const url = tabsPageUrl();
      // 新しく開く場合も引き取り先のウィンドウに置く。省略するとChromeは
      // 最後にアクティブだったウィンドウに開くため、storageへの書き込みを
      // 待つ間にユーザーが別のウィンドウへ移ると、これから全タブを閉じる
      // ウィンドウにtabsページが残らずウィンドウごと消える
      const createProperties: chrome.tabs.CreateProperties = {
        active: true,
        url: url,
        ...(adoptInto == null ? {} : { windowId: adoptInto }),
      };
      const opened = await openedTabsPages();
      // 複数枚開かれている場合は、引き取り先のウィンドウにあるものを優先する。
      // 引き取る必要がなく、ユーザーが見ていた位置もそのまま使える
      const target =
        (adoptInto == null
          ? undefined
          : opened.find((tab) => tab.windowId === adoptInto)) ?? opened[0];
      if (target == null) {
        await chrome.tabs.create(createProperties);
        return;
      }
      const targetId = target.id!;
      // 引き取れないウィンドウ（ポップアップ、別プロファイル）もあるため、
      // 移動の失敗でtabsページを開くのをやめない。移動できなくても
      // そのタブを前に出せば一覧は見られる
      let movedInto: number | null = null;
      if (adoptInto != null && target.windowId !== adoptInto) {
        try {
          await chrome.tabs.move(targetId, { windowId: adoptInto, index: -1 });
          movedInto = adoptInto;
        } catch (error) {
          console.error(error);
        }
      }
      try {
        await chrome.tabs.update(targetId, { active: true });
      } catch (error) {
        // 探した後に閉じられたタブへ書くと失敗する。一覧を開けないまま
        // 終わると、呼び出し元は保存だけ済んで何も起きていないように見える
        console.error(error);
        await chrome.tabs.create(createProperties);
        return;
      }
      const shownIn = movedInto ?? target.windowId;
      if (shownIn != null && shownIn !== adoptInto) {
        // 別ウィンドウのタブはアクティブにしても前面に来ないため、
        // ウィンドウ自体もフォーカスする
        await chrome.windows.update(shownIn, { focused: true });
      }
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

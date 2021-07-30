import {model} from "./types/interface";
import {blockService} from "./blockService";
import {util} from "./util";

export namespace chromeService {
  export namespace storage {

    export function getTabKey(index: number): string {
      return `td_${index}`;
    }

    export function getTabLengthKey(): string {
      return "t_len";
    }

    export function setSyncStorage(key: string, value: string): Promise<void> {
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


    export function getTabLengthOrZero(result: any): number {
      if (!result) {
        return 0;
      } else if (Number.isInteger(result)) {
        return Number(result);
      } else if (Number.isInteger(result[getTabLengthKey()])) {
        return Number(result[getTabLengthKey()]);
      } else {
        return 0;
      }
    }

    export function allClear(): void {
      if (window.confirm('保存したすべてのタブを削除します。よろしいですか？')) {
        chrome.storage.sync.clear(function () {
          alert('すべてのデータを削除しました');
        });
      }
    }

    export function getSyncStorage(key: string): Promise<string> {
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

    export function getSyncStorageReturnKey(key: string): Promise<[string, string]> {
      return getSyncStorage(key).then(result => {
          return [key, result]
        }
      )
    }


    async function getTabLength(): Promise<number> {
      return getSyncStorage(chromeService.storage.getTabLengthKey()).then(result => {
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


    export async function getAllBlockAndKey(): Promise<model.BlockAndKey[]> {
      let tabLength = await getTabLength()

      let promiseArray: Promise<[string, string]>[] = [];

      for (let i = 0; i < tabLength; i++) {
        const key = chromeService.storage.getTabKey(i);
        promiseArray.push(getSyncStorageReturnKey(key))
      }

      return Promise.all(promiseArray).then(result => {
        const nonEmptyArr = result.filter(obj => {
          return obj[1] != null && obj[1].length > 0
        })
        let blockAnyKeys: model.BlockAndKey[] = []
        for (const arr of nonEmptyArr) {
          const t: model.BlockAndKey = {
            key: arr[0],
            block: blockService.inflateJson(arr[1])
          }
          blockAnyKeys.push(t)
        }

        return blockAnyKeys.sort(sortBlockAnyKeys)
      });
    }

    export async function getAllBlock(): Promise<model.Block[]> {
      let tabLength = await getTabLength()

      let promiseArray: Promise<string>[] = [];

      for (let i = 0; i < tabLength; i++) {
        const key = chromeService.storage.getTabKey(i);
        promiseArray.push(getSyncStorage(key))
      }

      return Promise.all(promiseArray).then(result => {
        const nonEmptyArr = result.filter(obj => obj.length > 0)
        return blockService.blocksSort(nonEmptyArr.map(blockService.inflateJson))
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
  }
}

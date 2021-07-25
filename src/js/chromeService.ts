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
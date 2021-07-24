export function isEmpty(obj: object): boolean {
    return !Object.keys(obj).length;
}

export function getDomain(str: string): string {
    try {
        const parser = new URL(str);
        return parser.hostname;
    } catch (e) {
        if (e.code === "ERR_INVALID_URL") {
            return "";
        } else {
            throw e;
        }
    }
}

/**
 * https://qiita.com/saekis/items/c2b41cd8940923863791
 * @param string
 */
export function escape_html(string: string): string {
    // @ts-ignore
    return string.replace(/[&'`"<>]/g, function (match) {
        return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
        }[match]
    });
}

export function toNumber(str: string | number): number {
    let num = Number(str);
    if (isNaN(num)) {
        throw new Error('to Number Error: ' + str);
    }
    return num;
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

export function getTabKey(index: number): string {
    return `td_${index}`;
}

export function getTabLengthKey(): string {
    return "t_len";
}


export function deflate(val: string) {
    const encodeVal = encodeURIComponent(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const z_stream = ZLIB.deflateInit({level: 9});
    const encoded_string = z_stream.deflate(encodeVal);
    return window.btoa(encoded_string);
}

export function inflate(val: string) {
    const tobVal = window.atob(val);
    // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
    // @ts-ignore
    const z_stream = ZLIB.inflateInit();
    const decoded_string = z_stream.inflate(tobVal);
    return decodeURIComponent(decoded_string);
}

export function deflateJson(str: string) {
    const deflateStr = deflate(str);
    if (deflateStr.length < str.length) {
        return deflateStr;
    } else {
        return str;
    }
}

export function inflateJson(val: string) {
    try {
        return JSON.parse(val);
    } catch (e) {
        if (e instanceof SyntaxError) {
            const jsonStr = inflate(val);
            return JSON.parse(jsonStr);
        } else {
            throw e;
        }
    }
}

import {model} from "./types/interface";

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

// @ts-ignore
export function getTabLengthOrZero(result) {
    if (!result) {
        return 0;
    } else if (Number.isInteger(result)) {
        return result;
    } else if (Number.isInteger(result[getTabLengthKey()])) {
        return result[getTabLengthKey()];
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

// @ts-ignore
export function getSyncStorage(key) {
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

export function createTabs(properties: chrome.tabs.CreateProperties) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create(properties, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(error);
            } else {
                // @ts-ignore
                resolve();
            }
        });
    });
}

export function setSyncStorage(key: string, value: string) {
    let set_obj: { [key: string]: string; } = {};
    set_obj[key] = value;
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(set_obj, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(error);
            } else {
                resolve(true);
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

export function blockToJson(block: model.Block): string {
    let a = {
        // 既存のcreated_atがgetTimeで渡した数字を入れている(互換性) & 文字列としてTimeの方が短いため、Json上ではTimeを入れる
        created_at: block.created_at.getTime(),
        tabs: block.tabs
    }

    return JSON.stringify(a);
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


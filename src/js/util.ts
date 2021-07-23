// @ts-ignore
declare module "./zlib";

// @ts-ignore
export function isEmpty(obj) {
    return !Object.keys(obj).length;
}

// @ts-ignore
export function getDomein(str) {
    try {
        const parser = new URL(str);
        return parser.hostname;
    } catch (e) {
        if (e instanceof TypeError) {
            return "";
        } else {
            throw e;
        }
    }
}

// @ts-ignore
export function escape_html(string) {
    // https://qiita.com/saekis/items/c2b41cd8940923863791
    if (typeof string !== 'string') {
        return string;
    }
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

// @ts-ignore
export function toNumber(str) {
    let num = Number(str);
    if (isNaN(num)) {
        throw new Error('to Number Error: ' + str);
    }
    return num;
}

// @ts-ignore
export function gettabLengthOrZero(result) {
    if (!result) {
        return 0;
    } else if (Number.isInteger(result)) {
        return result;
    } else if (Number.isInteger(result[gettabLengthKey()])) {
        return result[gettabLengthKey()];
    } else {
        return 0;
    }
}

export function allClear() {
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

// @ts-ignore
export function createTabs(properties) {
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

// @ts-ignore
export function setSyncStorage(key, value) {
    let set_obj = {};
    // @ts-ignore
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

// @ts-ignore
export function getTabKey(index) {
    return `td_${index}`;
}

export function gettabLengthKey() {
    return "t_len";
}


// @ts-ignore
export function deflate(val) {
    const encodeVal = encodeURIComponent(val);
    // @ts-ignore
    const z_stream = ZLIB.deflateInit({level: 9});
    const encoded_string = z_stream.deflate(encodeVal);
    return window.btoa(encoded_string);
}

// @ts-ignore
export function inflate(val) {
    console.log(val);
    const tobVal = window.atob(val);
    // @ts-ignore
    const z_stream = ZLIB.inflateInit();
    const decoded_string = z_stream.inflate(tobVal);
    return decodeURIComponent(decoded_string);
}

// @ts-ignore
export function deflateJson(str) {
    const deflateStr = deflate(str);
    if (deflateStr.length < str.length) {
        return deflateStr;
    } else {
        return str;
    }
}

// @ts-ignore
export function inflateJson(val) {
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

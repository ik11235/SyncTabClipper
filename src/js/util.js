function isEmpty(obj) {
    return !Object.keys(obj).length;
}

function getDomein(str) {
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

function escape_html(string) {
    // https://qiita.com/saekis/items/c2b41cd8940923863791
    if (typeof string !== 'string') {
        return string;
    }
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

function toNumber(str) {
    let num = Number(str);
    if (isNaN(num)) {
        throw new Error('to Number Error: ' + str);
    }
    return num;
}

function gettabLengthOrZero(result) {
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

function allClear() {
    if (window.confirm('保存したすべてのタブを削除します。よろしいですか？')) {
        chrome.storage.sync.clear(function () {
            alert('すべてのデータを削除しました');
        });
    }
}

function getSyncStorage(key) {
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

function createTabs(properties) {
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

function setSyncStorage(key, value) {
    let set_obj = {};
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

function getTabKey(index) {
    return `td_${index}`;
}

function gettabLengthKey() {
    return "t_len";
}

function deflate(val) {
    const encodeVal = encodeURIComponent(val);
    const z_stream = ZLIB.deflateInit({level: 9});
    const encoded_string = z_stream.deflate(encodeVal);
    return btoa(encoded_string);
}

function inflate(val) {
    const tobVal = atob(val);
    const z_stream = ZLIB.inflateInit();
    const decoded_string = z_stream.inflate(tobVal);
    return decodeURIComponent(decoded_string);
}

function deflateJson(str) {
    const deflateStr = deflate(str);
    if (deflateStr.length < str.length) {
        return deflateStr;
    } else {
        return str;
    }
}

function inflateJson(val) {
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

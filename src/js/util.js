function isEmpty(obj) {
    return !Object.keys(obj).length;
}

function getDomein(str) {
    const parser = new URL(str);
    return parser.host;
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
    } else if (Number.isInteger(result.tab_length)) {
        return result.tab_length;
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
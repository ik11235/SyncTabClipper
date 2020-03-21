function isEmpty(obj) {
    return !Object.keys(obj).length;
}

function getDomein(str) {
    const parser = new URL(str);
    return parser.host;
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

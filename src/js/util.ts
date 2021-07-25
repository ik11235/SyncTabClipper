export namespace util {
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

    /**
     * 指定したelement内に含まれる「SyncTabClipper」を指定テキストに痴漢する
     * 開発時にmanifestに指定した、testやdev等の文字列に置換するために使用
     *
     * @param element
     * @param replaceStr
     */
    export function replacePageTitle(element: HTMLElement, replaceStr: string): void {
        element.innerHTML = element.innerHTML.replace("SyncTabClipper", replaceStr);

    }
}
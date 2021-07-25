export namespace zlibWrapper {
    export function deflate(val: string): string {
        const encodeVal = encodeURIComponent(val);
        // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
        // @ts-ignore
        const z_stream = ZLIB.deflateInit({level: 9});
        const encoded_string = z_stream.deflate(encodeVal);
        return window.btoa(encoded_string);
    }

    export function inflate(val: string): string {
        const tobVal = window.atob(val);
        // 既存のzlib.jsをtypeScriptでimportする方法がわからないので一旦直接呼び出す そのため、@ts-ignoreを指定している
        // @ts-ignore
        const z_stream = ZLIB.inflateInit();
        const decoded_string = z_stream.inflate(tobVal);
        return decodeURIComponent(decoded_string);
    }

}
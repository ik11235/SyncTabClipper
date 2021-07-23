import * as util from './util';

describe('util', (): void => {
    test('getDomain 正常系', (): void => {
        const res = util.getDomain("https://jestjs.io/ja/docs/getting-started")
        expect(res).toBe('jestjs.io');
    });
    test('getDomain URLでない文字列は空文字を返す', (): void => {
        const res = util.getDomain("test@example.com")
        expect(res).toBe('');
    });
})

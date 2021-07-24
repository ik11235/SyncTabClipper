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

    test('getTabLengthOrZero null->0', (): void => {
        const res = util.getTabLengthOrZero(null)
        const expected = 0
        expect(res).toStrictEqual(expected);
    });
    test('getTabLengthOrZero interger->number', (): void => {
        const res = util.getTabLengthOrZero(123)
        const expected = 123
        expect(res).toStrictEqual(expected);
    });
    test('getTabLengthOrZero result->number', (): void => {
        const res = util.getTabLengthOrZero({"t_len": 456})
        const expected = 456
        expect(res).toStrictEqual(expected);
    });
})

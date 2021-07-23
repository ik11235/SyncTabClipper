import * as util from './util';

describe('util', (): void => {
    test('getDomain 正常系', (): void => {
        const res = util.getDomain("https://jestjs.io/ja/docs/getting-started")
        expect(res).toBe('jestjs.io');
    });
})

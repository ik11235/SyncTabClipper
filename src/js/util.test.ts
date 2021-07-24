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

    test('blockToJson 正常系', (): void => {
        let block = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
                {
                    url: "http://google.com/test2",
                    title: "google-test"
                }
            ],
        }

        const res = util.blockToJson(block)
        expect(res).toBe("{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"}]}");
    });

    test('jsonToBlock 正常系', (): void => {
        let json = "{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"}]}"

        const res = util.jsonToBlock(json)
        const expected = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
                {
                    url: "http://google.com/test2",
                    title: "google-test"
                }
            ],
        }

        expect(res).toStrictEqual(expected);
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

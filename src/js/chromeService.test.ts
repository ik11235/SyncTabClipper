import {chromeService} from "./chromeService";

describe('chromeService', (): void => {
        describe('storage', (): void => {
            test('getTabLengthOrZero null->0', (): void => {
                const res = chromeService.storage.getTabLengthOrZero(null)
                const expected = 0
                expect(res).toStrictEqual(expected);
            });
            test('getTabLengthOrZero interger->number', (): void => {
                const res = chromeService.storage.getTabLengthOrZero(123)
                const expected = 123
                expect(res).toStrictEqual(expected);
            });
            test('getTabLengthOrZero result->number', (): void => {
                const res = chromeService.storage.getTabLengthOrZero({"t_len": 456})
                const expected = 456
                expect(res).toStrictEqual(expected);
            });
        })
    }
)
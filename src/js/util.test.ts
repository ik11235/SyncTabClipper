/**
 * @jest-environment jsdom
 *
 * node環境のURLはURLでない文字列に対しcode: 'ERR_INVALID_URL'を持つエラーを投げるが、
 * ブラウザのURLはcodeを持たないTypeErrorを投げる。この差でnode環境のテストは
 * 実挙動を検証できないため、拡張機能と同じjsdomで検証する
 */
import { util } from './util';

describe('util', (): void => {
  test('getDomain 正常系', (): void => {
    const res = util.getDomain('https://jestjs.io/ja/docs/getting-started');
    expect(res).toBe('jestjs.io');
  });

  // URLでない文字列で例外を投げると、タブ1件のurl不正で一覧全体が
  // ErrorBoundaryに落ちる(#192)ため、常に空文字列を返すことを担保する
  test.each([
    ['メールアドレス', 'test@example.com'],
    ['空文字列', ''],
    ['空白のみ', '   '],
    ['スキームなし', 'example.com/test'],
    ['スキームのみ', 'https://'],
  ])(
    'getDomain URLでない文字列(%s)は例外にせず空文字を返す',
    (_name: string, input: string): void => {
      expect(util.getDomain(input)).toBe('');
    },
  );

  test('toNumber 正常系string', (): void => {
    const res = util.toNumber('123');
    expect(res).toBe(123);
  });

  test('toNumber 正常系NUmber', (): void => {
    const res = util.toNumber(12345);
    expect(res).toBe(12345);
  });

  test('toNumber 異常系string', (): void => {
    expect(() => {
      util.toNumber('10M');
    }).toThrow('to Number Error: 10M');
  });
});

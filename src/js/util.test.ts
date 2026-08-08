/**
 * @jest-environment jsdom
 *
 * getDomainはブラウザ上で動くコードなので、URLコンストラクタの挙動が
 * ブラウザと同じ環境で検証する。node環境のURLはERR_INVALID_URLという
 * codeを持つため、ブラウザでは例外になるケースまで緑になってしまう
 */
import { util } from './util';

describe('util', (): void => {
  test('getDomain 正常系', (): void => {
    const res = util.getDomain('https://jestjs.io/ja/docs/getting-started');
    expect(res).toBe('jestjs.io');
  });

  // 読み込みが確定していないタブのurlは空文字列になりうる。
  // ここで例外を投げるとErrorBoundaryが一覧全体を落とす
  test.each([
    ['URLでない文字列', 'test@example.com'],
    ['空文字列', ''],
    ['空白のみ', '   '],
    ['スキームがない', 'example.com/path'],
  ])('getDomain %s は空文字を返す', (_name: string, input: string): void => {
    expect(util.getDomain(input)).toBe('');
  });

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

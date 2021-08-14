import { util } from './util';

describe('util', (): void => {
  test('getDomain 正常系', (): void => {
    const res = util.getDomain('https://jestjs.io/ja/docs/getting-started');
    expect(res).toBe('jestjs.io');
  });
  test('getDomain URLでない文字列は空文字を返す', (): void => {
    const res = util.getDomain('test@example.com');
    expect(res).toBe('');
  });

  test('escape_html 正常系', (): void => {
    const res = util.escapeHtml('<html>aaa</html>');
    expect(res).toBe('&lt;html&gt;aaa&lt;/html&gt;');
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
    }).toThrowError('to Number Error: 10M');
  });
});

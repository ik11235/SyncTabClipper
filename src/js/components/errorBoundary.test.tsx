/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ErrorBoundary } from './errorBoundary';
import { chromeService } from '../chromeService';

// テスティングライブラリを介さず素のactを使うため必要
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('ErrorBoundary', (): void => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: jest.SpyInstance;
  // 子が何回レンダリングを試みたか。落ちたままリセットを繰り返して
  // レンダリングが振動しないことを見るために数える
  let renderCount: number;

  // throwsがtrueの間はレンダリングで例外を投げる子
  const Child: React.FC<{ throws: boolean }> = (props) => {
    renderCount += 1;
    if (props.throws) {
      throw new Error('boom');
    }
    return <span>child</span>;
  };

  const render = (props: {
    throws: boolean;
    resetKey?: unknown;
    fallback?: React.ReactNode;
  }): Promise<void> =>
    act(async () => {
      root.render(
        <ErrorBoundary resetKey={props.resetKey} fallback={props.fallback}>
          <Child throws={props.throws} />
        </ErrorBoundary>,
      );
    });

  beforeEach((): void => {
    renderCount = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
    // Reactが境界で捕捉した例外をconsole.errorへ出力するため抑止する
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach((): void => {
    act(() => root.unmount());
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  test('捕捉後にresetKeyが変わればレンダリングをやり直す', async (): Promise<void> => {
    await render({
      throws: true,
      resetKey: 'v1',
      fallback: <span>broken</span>,
    });
    expect(container.textContent).toBe('broken');

    // 落ちた原因のデータが差し替わった状況
    await render({
      throws: false,
      resetKey: 'v2',
      fallback: <span>broken</span>,
    });

    expect(container.textContent).toBe('child');
  });

  test('resetKeyが変わらなければデータが直ってもfallbackのまま', async (): Promise<void> => {
    await render({
      throws: true,
      resetKey: 'v1',
      fallback: <span>broken</span>,
    });
    // resetKeyは据え置き。読み直しても中身が変わらなかったブロックに相当する
    await render({
      throws: false,
      resetKey: 'v1',
      fallback: <span>broken</span>,
    });

    expect(container.textContent).toBe('broken');
  });

  test('resetKeyを渡さない呼び出しは従来どおりfallbackに固定される', async (): Promise<void> => {
    await render({ throws: true, fallback: <span>broken</span> });
    await render({ throws: false, fallback: <span>broken</span> });

    expect(container.textContent).toBe('broken');
  });

  test('直っていないデータで再試行してもfallbackに収束する', async (): Promise<void> => {
    await render({
      throws: true,
      resetKey: 'v1',
      fallback: <span>broken</span>,
    });
    const rendersForFirstAttempt = renderCount;

    // 壊れたまま読み直された状況。再試行してまた落ちる
    await render({
      throws: true,
      resetKey: 'v2',
      fallback: <span>broken</span>,
    });
    expect(container.textContent).toBe('broken');
    // 増えるのは再試行1回分だけ。リセットと例外を繰り返して回り続けない
    expect(renderCount).toBe(rendersForFirstAttempt * 2);

    // 同じresetKeyで再レンダリングされても、もう再試行しない
    await render({
      throws: true,
      resetKey: 'v2',
      fallback: <span>broken</span>,
    });
    expect(renderCount).toBe(rendersForFirstAttempt * 2);
  });

  test('落ちていなければresetKeyが変わっても子を作り直さない', async (): Promise<void> => {
    await render({ throws: false, resetKey: 'v1' });
    const rendersBefore = renderCount;

    await render({ throws: false, resetKey: 'v2' });

    // resetKeyの変更で親が再レンダリングされる1回だけ
    expect(renderCount).toBe(rendersBefore + 1);
    expect(container.textContent).toBe('child');
  });

  test('fallbackを渡さない境界は捕捉した例外をerrorLogへ記録する', async (): Promise<void> => {
    const errorLogSpy = jest
      .spyOn(chromeService.errorLog, 'set')
      .mockResolvedValue(undefined);

    try {
      await render({ throws: true, resetKey: 'v1' });
      expect(container.textContent).toBe('');
      expect(errorLogSpy).toHaveBeenCalledTimes(1);

      // 読み直しで直れば表示が戻る（この境界が落ちると一覧全体が失われる）
      await render({ throws: false, resetKey: 'v2' });
      expect(container.textContent).toBe('child');
    } finally {
      errorLogSpy.mockRestore();
    }
  });
});

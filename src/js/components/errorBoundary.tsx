import React from 'react';
import { chromeService } from '../chromeService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // 例外を捕捉したときに代わりに表示する要素。省略時は何も表示しない
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * 子のレンダリング時例外がページ全体を巻き込んでアンマウントするのを防ぐ。
 * 捕捉した例外はerrorLogへ保存し、表示はErrorDisplayに任せる。
 * fallbackを指定した場合はそれ自体が表示になるためerrorLogへは保存しない
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    if (this.props.fallback != null) {
      // fallbackが代わりに表示され、何が起きたかはユーザーに見えているため、
      // errorLog（バッジ+アラート）では通知せずログだけ残す。
      // 生の例外メッセージをアラートに出しても利用者には手掛かりにならない
      console.error(error);
      return;
    }
    chromeService.errorLog.set(error).catch(console.error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

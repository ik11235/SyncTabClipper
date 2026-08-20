import React from 'react';
import { chromeService } from '../chromeService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // 例外を捕捉したときに代わりに表示する要素。省略時は何も表示しない
  fallback?: React.ReactNode;
  // 表示をやり直す契機。捕捉後にこの値が変わったら子のレンダリングを再試行する。
  // 呼び出し側は「落ちた原因のデータ」そのものを渡す（データが差し替わって
  // 初めて再試行されるため、直っていないうちは何度読み直しても再試行しない）
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * 子のレンダリング時例外がページ全体を巻き込んでアンマウントするのを防ぐ。
 * 捕捉した例外はerrorLogへ保存し、表示はErrorDisplayに任せる。
 * fallbackを指定した場合はそれ自体が表示になるためerrorLogへは保存しない。
 * 一度捕捉すると表示はfallbackに固定されるため、データが直ったら
 * resetKeyを変えて再試行させる（境界のkeyは位置の固定に使っており、
 * 同じ位置のデータが差し替わっても再マウントは起きない）
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // 再試行するのは落ちている間だけ。resetKeyが変わり続けても、
    // 落ちていない子を無駄に作り直さない
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      // 直っていなければ再試行でまた捕捉してfallbackに戻る。
      // このとき増えるレンダリングはresetKeyが変わった1回分に留まる
      // （propsは既に新しい値なので、この更新では再試行しない）
      this.setState({ hasError: false });
    }
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

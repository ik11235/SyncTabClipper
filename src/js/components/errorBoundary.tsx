import React from 'react';
import { chromeService } from '../chromeService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // 例外を捕捉したときに代わりに表示する要素。省略時は何も表示しない
  fallback?: React.ReactNode;
  // 表示をやり直す契機。この値が変わったら子のレンダリングを再試行する。
  // 一覧の読み直し(#249)は内容が同じでもBlockEntryを作り直すため、
  // 呼び出し側が落ちた原因のデータを渡すと「読み直しごとに1回再試行する」
  // 意味になる。直っていなければ同じレンダーの中でfallbackへ戻る
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  hasError: boolean;
  // 直近のレンダリングで見たresetKey。propsとの差分でリセットを判断する
  resetKey: unknown;
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
  state: ErrorBoundaryState = {
    hasError: false,
    resetKey: this.props.resetKey,
  };

  // 直近にerrorLogへ記録したメッセージ。同じ壊れ方で再試行するたびに
  // 記録し直すと、利用者が閉じたアラートとバッジが読み直しごとに復活する
  private loggedMessage: string | null = null;

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  // componentDidUpdateでリセットすると、fallbackを描いたコミットの後に
  // 子を描き直す別のコミットが挟まる。そのコミットでは親は再レンダリング
  // されないため、親のuseLayoutEffectが古いDOM（fallback）を見たまま
  // 取り残される（並び替えの演出が誤発火する）。同じレンダーの中で
  // 決着させるため、propsからstateを導出する形でリセットする
  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: unknown): void {
    if (this.props.fallback != null) {
      // fallbackが代わりに表示され、何が起きたかはユーザーに見えているため、
      // errorLog（バッジ+アラート）では通知せずログだけ残す。
      // 生の例外メッセージをアラートに出しても利用者には手掛かりにならない
      console.error(error);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === this.loggedMessage) {
      // 再試行して同じ壊れ方で落ちただけ。通知は既に出している
      console.error(error);
      return;
    }
    this.loggedMessage = message;
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

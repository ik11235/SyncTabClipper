import React, { useEffect, useState } from 'react';
import { chromeService } from '../chromeService';

export const ErrorDisplay: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chromeService.errorLog.get().then(setError).catch(console.error);

    // ページ表示中に発生したエラー（tabsページ内の操作やbackground由来）の
    // 即時表示と、他ページでの確認済みクリアへの追随のため
    // storage.localの変更を監視する
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      const change = changes[chromeService.errorLog.errorKey];
      if (areaName === 'local' && change != null) {
        if (typeof change.newValue === 'string') {
          setError(change.newValue);
        } else if (document.visibilityState === 'hidden') {
          // ユーザーが他の可視ページでエラーを確認（消費）した。
          // このページは見えていないので表示を取り下げる。
          // 可視ページでは確認済みのアラートをリロードか×まで残す
          setError(null);
        }
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  // アラートがユーザーの目に入った時点で保存とバッジをクリア（確認済み扱い）。
  // マウント時に消費してしまうと、裏で開いているページが先に消費して
  // 後から開いたページに表示されなくなるため、可視状態になるまで消費しない
  useEffect(() => {
    if (error == null) {
      return;
    }
    const consumeIfVisible = () => {
      if (document.visibilityState === 'visible') {
        chromeService.errorLog.clear().catch(console.error);
      }
    };
    consumeIfVisible();
    document.addEventListener('visibilitychange', consumeIfVisible);
    return () =>
      document.removeEventListener('visibilitychange', consumeIfVisible);
  }, [error]);

  if (error == null) {
    return null;
  }

  const close = () => {
    setError(null);
    chromeService.errorLog.clear().catch(console.error);
  };

  // data-uk-alertを付けるとUIkitがReactを介さずDOMノードを削除してしまい
  // 以降の再レンダリングと不整合を起こすため、閉じる処理はReactのstateで行う
  return (
    <div className="uk-alert uk-alert-danger">
      <a className="uk-alert-close" data-uk-close="true" onClick={close}></a>
      <p>{error}</p>
    </div>
  );
};

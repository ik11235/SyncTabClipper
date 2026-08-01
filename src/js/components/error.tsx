import React, { useEffect, useState } from 'react';
import { chromeService } from '../chromeService';

export const ErrorDisplay: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const showError = (message: string | null) => {
      if (message != null) {
        setError(message);
      }
    };
    chromeService.errorLog.pop().then(showError).catch(console.error);

    // ページ表示中に発生したエラー（tabsページ内の操作やbackground由来）も
    // 即時表示できるようstorage.localの変更を監視する
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (
        areaName === 'local' &&
        changes[chromeService.errorLog.errorKey]?.newValue != null
      ) {
        chromeService.errorLog.pop().then(showError).catch(console.error);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  if (error == null) {
    return null;
  }
  // data-uk-alertを付けるとUIkitがReactを介さずDOMノードを削除してしまい
  // 以降の再レンダリングと不整合を起こすため、閉じる処理はReactのstateで行う
  return (
    <div className="uk-alert uk-alert-danger">
      <a
        className="uk-alert-close"
        data-uk-close="true"
        onClick={() => setError(null)}
      ></a>
      <p>{error}</p>
    </div>
  );
};

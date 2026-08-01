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
  return (
    <div className="uk-alert-danger" data-uk-alert="true">
      <a className="uk-alert-close" data-uk-close="true"></a>
      <p>{error}</p>
    </div>
  );
};

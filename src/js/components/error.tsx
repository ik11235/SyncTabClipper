import React, { useEffect, useState } from 'react';
import { chromeService } from '../chromeService';

export const ErrorDisplay: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 表示時にはエラーを消費（クリア）しない。クリアしてしまうと、
    // 別ウィンドウなどで既に開いているtabsページが先に消費し、
    // 後から開いたページに何も表示されなくなる
    chromeService.errorLog.get().then(setError).catch(console.error);

    // ページ表示中に発生したエラー（tabsページ内の操作やbackground由来）の
    // 即時表示と、他ページでの閉じる操作・保存成功によるクリアへの追随の
    // ためstorage.localの変更を監視する
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      const change = changes[chromeService.errorLog.errorKey];
      if (areaName === 'local' && change != null) {
        setError(change.newValue ?? null);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

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

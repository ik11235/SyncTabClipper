import React, { useEffect, useState } from 'react';

const StorageUsage: React.FC = () => {
  // 取得完了まで表示しない（nullはロード中を表す）
  const [bytesInUse, setBytesInUse] = useState<number | null>(null);
  const totalBytes = chrome.storage.sync.QUOTA_BYTES;

  useEffect(() => {
    const updateBytesInUse = () => {
      chrome.storage.sync
        .getBytesInUse()
        .then(setBytesInUse)
        .catch(console.error);
    };
    updateBytesInUse();

    // タブの保存・削除・インポートなどの操作後に使用量を追随させるため
    // storage.syncの変更を監視して再取得する
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'sync') {
        updateBytesInUse();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  if (bytesInUse == null) {
    return null;
  }

  const percentage = ((bytesInUse / totalBytes) * 100).toFixed(2);

  return (
    <div className="uk-card uk-card-default uk-card-body uk-margin-top storage-usage">
      <h4 className="uk-card-title uk-margin-remove-bottom">
        {chrome.i18n.getMessage('content_msg_storage_usage')}
      </h4>
      <progress className="uk-progress" value={bytesInUse} max={totalBytes} />
      <p className="uk-text-meta uk-margin-remove-top">
        {chrome.i18n.getMessage('content_msg_storage_usage_detail', [
          bytesInUse.toLocaleString(),
          totalBytes.toLocaleString(),
          percentage,
        ])}
      </p>
    </div>
  );
};

export default StorageUsage;

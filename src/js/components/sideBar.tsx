import React, { useRef, useState } from 'react';
import { blockService } from '../blockService';
import { chromeService } from '../chromeService';
import StorageUsage from './storageUsage';

interface SideBarProps {
  // storageの全削除とブロック一覧stateの更新はApp側で行う
  deleteAllBlocks: () => Promise<void>;
}

const SideBar: React.FC<SideBarProps> = (props) => {
  const [exportText, setExportText] = useState('');
  const importRef = useRef<HTMLTextAreaElement>(null);

  // エラー通知はerrorLogに統一する（ErrorDisplayがonChangedで即時表示する）
  const notifyError = (error: unknown) => {
    chromeService.errorLog.set(error).catch(console.error);
  };

  const exportJson = () => {
    blockService
      .exportAllDataJson()
      .then((result) => {
        setExportText(result.json);
        if (result.brokenCount > 0) {
          // 欠けたバックアップを完全なものと誤解して全データ削除に進むのを防ぐ。
          // エクスポート自体は成功しているためerrorLog（赤バッジ+アラート）には
          // 流さず、ユーザー操作への応答としてその場で伝える
          alert(
            chrome.i18n.getMessage('content_msg_export_broken_block', [
              String(result.brokenCount),
            ]),
          );
        }
      })
      .catch(notifyError);
  };

  const importJson = () => {
    blockService
      .importAllDataJson(importRef.current!.value)
      // catchはインポート自体の失敗だけを受ける。通知や読み込み直しまで
      // 巻き込むと、書き込みは済んでいるのに
      // 「インポートに失敗しました」と出て再インポートを促してしまう
      .catch((error) => {
        notifyError(
          chrome.i18n.getMessage('content_msg_failed_import') +
            ' ' +
            (error instanceof Error ? error.message : String(error)),
        );
        return null;
      })
      .then((result) => {
        if (result == null) {
          return;
        }
        if (result.importedCount === 0) {
          // 1件も書き込めていないならstorageは何も変わっていないので、
          // 読み込み直しても貼り付けた内容とエクスポート結果を捨てるだけ。
          // 読み込み直さないならerrorLogが読み込み直しで消えることもなく、
          // インポート自体が失敗したとき(上のcatch)と結末は同じなので、
          // 赤バッジが残るerrorLogに通知を揃える
          if (result.failedCount > 0) {
            notifyError(
              chrome.i18n.getMessage('content_msg_import_all_failed', [
                String(result.failedCount),
              ]),
            );
          }
          return;
        }
        if (result.failedCount > 0) {
          // errorLogに流すと、可視ページのErrorDisplayがその場で
          // 確認済みとして消してしまい、読み込み直した先には残らない。
          // alertは閉じるまで同期的に止まるので、読み込み直しの前に必ず届く
          alert(
            chrome.i18n.getMessage('content_msg_import_partial_failure', [
              String(result.importedCount + result.failedCount),
              String(result.failedCount),
            ]),
          );
        }
        chrome.tabs.reload({ bypassCache: true });
      })
      .catch(console.error);
  };

  const deleteAllData = () => {
    if (
      window.confirm(chrome.i18n.getMessage('content_msg_all_delete_confirm'))
    ) {
      props
        .deleteAllBlocks()
        .then(() =>
          alert(chrome.i18n.getMessage('content_msg_all_delete_finish')),
        )
        .catch(notifyError);
    }
  };

  return (
    <aside className="uk-width-auto">
      <div className="uk-card uk-card-default uk-card-body">
        {/* uk-nav/uk-iconはReact管理下のノードを削除しないため共存できる。
            uk-alertのようにノード自体を削除するUIkitコンポーネントは不可 */}
        <ul
          className="uk-nav-default uk-nav-parent-icon"
          data-uk-nav="multiple: true"
        >
          <li className="uk-nav-header">
            {chrome.i18n.getMessage('content_msg_menu')}
          </li>
          <li className="uk-parent uk-active">
            <a href="#">
              <span
                className="uk-margin-small-right"
                data-uk-icon="icon: pull"
              />
              {chrome.i18n.getMessage('content_msg_export')}
            </a>
            <ul className="uk-nav-sub">
              <li>
                <label htmlFor="export_body" />
                <textarea
                  readOnly={true}
                  id="export_body"
                  rows={4}
                  value={exportText}
                />
              </li>
              <li>
                <button id="export_link" onClick={exportJson}>
                  {chrome.i18n.getMessage('content_msg_export_exec')}
                </button>
              </li>
            </ul>
          </li>
          <li className="uk-parent uk-active">
            <a href="#">
              <span
                className="uk-margin-small-right"
                data-uk-icon="icon: push"
              />
              {chrome.i18n.getMessage('content_msg_import')}
            </a>
            <ul className="uk-nav-sub">
              <li>
                <label htmlFor="import_body" />
                <textarea id="import_body" rows={4} ref={importRef} />
              </li>
              <li>
                <button id="import_link" onClick={importJson}>
                  {chrome.i18n.getMessage('content_msg_import_exec')}
                </button>
              </li>
            </ul>
          </li>
          {/* 通常操作と破壊的操作の境目を視覚的に区切る */}
          <li className="uk-nav-divider" />
          {/* 破壊的操作は誤クリックを防ぐためデフォルトで閉じたメニューに隠す (#207) */}
          <li className="uk-parent uk-active">
            <a href="#">
              <span
                className="uk-margin-small-right"
                data-uk-icon="icon: cog"
              />
              {chrome.i18n.getMessage('content_msg_advanced_menu')}
            </a>
            <ul className="uk-nav-sub">
              {/* 実行前に読ませるため注意書きをボタンより先に置く */}
              <li>
                <div className="destructive-note">
                  <span
                    className="destructive-note-icon"
                    data-uk-icon="icon: warning; ratio: 0.8"
                  />
                  <span>
                    {chrome.i18n.getMessage('content_msg_destructive_warning')}
                  </span>
                </div>
                <button
                  id="all_clear"
                  className="uk-button uk-button-default uk-button-small destructive-action"
                  onClick={deleteAllData}
                >
                  <span
                    className="uk-margin-small-right"
                    data-uk-icon="icon: trash"
                  />
                  {chrome.i18n.getMessage('content_msg_all_data_delete')}
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <StorageUsage />
    </aside>
  );
};

export default SideBar;

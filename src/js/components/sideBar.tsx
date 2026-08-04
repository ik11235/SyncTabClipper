import React, { useRef, useState } from 'react';
import { blockService } from '../blockService';
import { chromeService } from '../chromeService';

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
    blockService.exportAllDataJson().then(setExportText).catch(notifyError);
  };

  const importJson = () => {
    blockService
      .importAllDataJson(importRef.current!.value)
      .catch((error) =>
        notifyError(
          chrome.i18n.getMessage('content_msg_failed_import') +
            ' ' +
            (error instanceof Error ? error.message : String(error)),
        ),
      );
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
          <li className="uk-active">
            <a href="#" id="all_clear" onClick={deleteAllData}>
              <span
                className="uk-margin-small-right"
                data-uk-icon="icon: trash"
              />
              {chrome.i18n.getMessage('content_msg_all_data_delete')}
            </a>
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
        </ul>
      </div>
    </aside>
  );
};

export default SideBar;

import React from 'react';
import { blockService } from '../blockService';
import { chromeService } from '../chromeService';

const SideBar: React.FC = () => {
  const exportJson = () => {
    const exportTextElement = document.getElementById(
      'export_body'
    ) as HTMLInputElement;
    blockService.exportAllDataJson(exportTextElement);
  };

  const importJson = () => {
    const importTextElement = document.getElementById(
      'import_body'
    ) as HTMLInputElement;
    blockService
      .importAllDataJson(importTextElement.value)
      .catch((error) =>
        alert(
          chrome.i18n.getMessage('content_msg_failed_import') +
            '\n' +
            error.message
        )
      );
  };

  const deleteAllData = () => {
    if (
      window.confirm(chrome.i18n.getMessage('content_msg_all_delete_confirm'))
    ) {
      chromeService.storage
        .allClear()
        .then((_) =>
          alert(chrome.i18n.getMessage('content_msg_all_delete_finish'))
        );
    }
  };

  return (
    <aside className="uk-width-auto">
      <div className="uk-card uk-card-default uk-card-body">
        <ul
          className="uk-nav-default uk-nav-parent-icon"
          uk-nav="multiple: true"
        >
          <li className="uk-nav-header">
            {chrome.i18n.getMessage('content_msg_menu')}
          </li>
          <li className="uk-active">
            <a href="#" id="all_clear" onClick={deleteAllData}>
              <span className="uk-margin-small-right" uk-icon="icon: trash" />
              {chrome.i18n.getMessage('content_msg_all_data_delete')}
            </a>
          </li>
          <li className="uk-parent">
            <a href="#">
              <span className="uk-margin-small-right" uk-icon="icon: pull" />
              {chrome.i18n.getMessage('content_msg_export')}
            </a>
            <ul className="uk-nav-sub">
              <li>
                <label htmlFor="export_body" />
                <textarea readOnly={true} id="export_body" rows={4} />
              </li>
              <li>
                <button id="export_link" onClick={exportJson}>
                  {chrome.i18n.getMessage('content_msg_export_exec')}
                </button>
              </li>
            </ul>
          </li>
          <li className="uk-parent">
            <a href="#">
              <span className="uk-margin-small-right" uk-icon="icon: push" />
              {chrome.i18n.getMessage('content_msg_import')}
            </a>
            <ul className="uk-nav-sub">
              <li>
                <label htmlFor="import_body" />
                <textarea id="import_body" rows={4} />
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

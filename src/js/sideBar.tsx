import React from "react";

const SideBar: React.FC = () => {
    return (
        <aside className="uk-width-auto">
            <div className="uk-card uk-card-default uk-card-body">
                <ul className="uk-nav-default uk-nav-parent-icon" uk-nav="multiple: true">
                    <li className="uk-nav-header">メニュー</li>
                    <li className="uk-active">
                        <a href="#" id="all_clear"><span className="uk-margin-small-right" uk-icon="icon: trash"/>
                            すべてのデータを削除する
                        </a>
                    </li>
                    <li className="uk-parent">
                        <a href="#"><span className="uk-margin-small-right" uk-icon="icon: pull"/>export</a>
                        <ul className="uk-nav-sub">
                            <li>
                                <label htmlFor="export_body"/>
                                <textarea readOnly={true} id="export_body" rows={4}/>
                            </li>
                            <li>
                                <button id="export_link">export実行</button>
                            </li>
                        </ul>
                    </li>
                    <li className="uk-parent">
                        <a href="#"><span className="uk-margin-small-right" uk-icon="icon: push"/>import</a>
                        <ul className="uk-nav-sub">
                            <li>
                                <label htmlFor="import_body"/>
                                <textarea id="import_body" rows={4}/>
                            </li>
                            <li>
                                <button id="import_link">import実行</button>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>
        </aside>
    );
};

export const SideBarDom = () =>
    <SideBar/>
;
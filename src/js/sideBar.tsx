import React from "react";

const SideBar: React.FC = () => {
    return (
        <aside className="uk-width-auto">
            <div className="uk-card uk-card-default uk-card-body">
                <ul className="uk-nav-default uk-nav-parent-icon" uk-nav="multiple: true">
                    <li className="uk-nav-header">メニュー</li>
                    <li className="uk-active">
                        <a href="#" id="all_clear"><span className="uk-margin-small-right" uk-icon="icon: trash"></span>
                            すべてのデータを削除する
                        </a>
                    </li>
                    <li className="uk-parent">
                        <a href="#"><span className="uk-margin-small-right" uk-icon="icon: pull"></span>export</a>
                        <ul className="uk-nav-sub">
                            <li>
                                <label htmlFor="export_body"></label><textarea readOnly={true} id="export_body"
                                                                               rows={4}></textarea>
                            </li>
                            <li>
                                <button id="export_link">export実行</button>
                            </li>
                        </ul>
                    </li>
                    <li className="uk-parent">
                        <a href="#"><span className="uk-margin-small-right" uk-icon="icon: push"></span>import</a>
                        <ul className="uk-nav-sub">
                            <li><label htmlFor="import_body"></label><textarea id="import_body" rows={4}></textarea>
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
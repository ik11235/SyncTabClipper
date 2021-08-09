import UIkit from 'uikit';
// @ts-ignore
import Icons from 'uikit/dist/js/uikit-icons';
import {chromeService} from "./chromeService";
import ReactDOM from "react-dom";
import Main from "./components/block";
import SideBar from "./sideBar";
import Header from "./header";
import React from "react";

// @ts-ignore
UIkit.use(Icons);

window.onload = function () {
    const header = document.getElementById('header')!
    ReactDOM.render(<Header/>, header);

    const sidebar = document.getElementById('sidebar')!
    ReactDOM.render(<SideBar/>, sidebar);

    chromeService.storage.getAllNewBlock().then(blocks => {
        const main = document.getElementById('main')!

        ReactDOM.render(<Main Block={blocks}/>, main);
    });
};

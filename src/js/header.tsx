import React from "react";

const Header: React.FC = () => {
    const titleText = chrome.runtime.getManifest().name;

    return (
        <h1 className='uk-heading-primary uk-heading-divider'>
            <img src="images/icon.svg" width="32" height="32"/>
            {titleText}
        </h1>
    );
}

export default Header;
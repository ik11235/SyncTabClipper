import {model} from "../types/interface";
import React from "react";
import Block from "./block"

interface MainProps {
    Block: model.NewBlock[]
}

const Main: React.FC<MainProps> = (props) => {
    if (props.Block.length > 0) {
        return (
            <div>
                {props.Block.reverse().map((block) => {
                    return <Block tabs={block.tabs}
                                  indexNum={block.indexNum}
                                  created_at={block.created_at}
                                  key={block.indexNum}
                    />;
                })}
            </div>
        );
    } else {
        return (
            <div className="uk-header">
                <h3 className="uk-title uk-margin-remove-bottom no-tabs">保存済みのタブはありません。</h3>
            </div>
        );
    }
};
export default Main;
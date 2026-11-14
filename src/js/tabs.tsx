import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import { createRoot } from 'react-dom/client';
import App from './components/app';
// CSSもnpmのuikitから読み込む。src/cssにコピーを置くとJS側とバージョンがずれるため
import 'uikit/dist/css/uikit.min.css';
// UIkitを上書きするため必ずuikitの後に読み込む
import '../css/app.css';

// UIkitのプラグイン登録でReact Hookではない。use始まりの名前でrules-of-hooksが誤検知する
// eslint-disable-next-line @eslint-react/rules-of-hooks
UIkit.use(Icons);

// scriptはdefer読み込みのため、実行時点で#rootは必ず存在する
createRoot(document.getElementById('root')!).render(<App />);

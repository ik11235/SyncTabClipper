import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import { createRoot } from 'react-dom/client';
import App from './components/app';
import '../css/uikit.min.css';

UIkit.use(Icons);

// scriptはdefer読み込みのため、実行時点で#rootは必ず存在する
createRoot(document.getElementById('root')!).render(<App />);

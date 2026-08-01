# SyncTabClipper

![icon128](https://github.com/ik11235/SyncTabClipper/raw/master/src/images/icon128.png)

[![test](https://github.com/ik11235/SyncTabClipper/actions/workflows/test.yml/badge.svg)](https://github.com/ik11235/SyncTabClipper/actions/workflows/test.yml)

「SyncTabClipper」は Chrome で開いているタブを 1 つのページにまとめる Chrome 拡張です。

まとめたタブ情報は Chrome アカウントに紐付いており、複数端末で同期されます。

[制作雑記](https://ik-fib.com/2020/03/synctabclipper/)

## インストール

[Chrome ウェブストア](https://chrome.google.com/webstore/detail/synctabclipper/dlmommjngcoidankihhgklpoiknaabki)からインストールできます。

## 使い方

- ツールバーの拡張アイコンをクリックすると、現在のウィンドウで開いているタブをすべて閉じて 1 つのページに保存します
- ページ上の右クリックメニューから、保存ページ（タブ一覧）を開くこともできます
- 保存ページからは、タブを個別に開く・まとめて復元する・削除するといった操作ができます
- 保存したタブは `chrome.storage.sync` 経由で同期されるため、同じアカウントでログインした別の端末からも参照できます

## 開発

### 必要環境

- Node.js / npm
- TypeScript + React + webpack で構成されています（Manifest V3）

### ビルド

```bash
npm i
npm run build
```

`dist/` にビルド成果物が生成されます。[Chrome の拡張機能管理ページ](chrome://extensions/)（`chrome://extensions/`）でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から `dist/` を読み込んでください。

開発中は `npm run watch` でファイル変更を監視して自動ビルドできます。

### テスト・Lint

```bash
npm test            # Jest によるユニットテスト
npm run lint        # ESLint
npm run format      # Prettier で整形
npm run format:check
```

テストと Lint は GitHub Actions（[test.yml](.github/workflows/test.yml)）でも実行されます。

### リリース作業

1. `npm run build:prod` を実行して `archive.zip` を作成する
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) で対象の拡張を選択し、「パッケージ」→「新しいパッケージのアップロード」で `archive.zip` をアップロードする
3. 入力事項を必要に応じて更新し、「アイテムを公開」する

## ライセンス

[MIT](LICENSE)

## チェンジログ

[CHANGELOG](CHANGELOG.md)

## クレジット

### アイコンについて

この拡張のアプリアイコンは [ICOON MONO 様](https://icooon-mono.com/)の[「手帳のアイコン素材」](https://icooon-mono.com/11138-%e6%89%8b%e5%b8%b3%e3%81%ae%e3%82%a2%e3%82%a4%e3%82%b3%e3%83%b3%e7%b4%a0%e6%9d%90/)を使用しています。

### 使用しているライブラリ

- [UIkit](https://getuikit.com/)
- [zlib-js](http://www33146ue.sakura.ne.jp/staff/iz/release/zlib-js/zlib-js.html)
- [React](https://react.dev/)

[使用ライブラリのライセンスクレジット一覧](CREDITS)

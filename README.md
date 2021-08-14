# SyncTabClipper

![icon128](https://github.com/ik11235/SyncTabClipper/raw/master/src/images/icon128.png)

# about

「SyncTabClipper」は chrome で開いているタブを 1 つのページにまとめる Chrome 拡張です。

まとめたタブ情報はアカウントに紐付いており、複数端末で同期されます。

[制作雑記](https://ik-fib.com/2020/03/synctabclipper/)

# インストール

[ここから](https://chrome.google.com/webstore/detail/synctabclipper/dlmommjngcoidankihhgklpoiknaabki)

# etc

## ライセンス

[MIT](LICENSE)

## チェンジログ

[CHANGELOG](CHANGELOG.md)

## アイコンについて

この拡張のアプリアイコンは[ICOON MONO 様](https://icooon-mono.com/)の[「手帳のアイコン素材」](https://icooon-mono.com/11138-%e6%89%8b%e5%b8%b3%e3%81%ae%e3%82%a2%e3%82%a4%e3%82%b3%e3%83%b3%e7%b4%a0%e6%9d%90/)を使用しています。

## 使用しているライブラリ

- [UIkit](https://getuikit.com/)
- [zlib-js](http://www33146ue.sakura.ne.jp/staff/iz/release/zlib-js/zlib-js.html)

- [使用ライブラリのライセンスクレジット一覧](CREDITS)

## build

```bash
npm i
npm run build
```

`dist/` にビルド成果物が生成されるので、そのディレクトリを (Chrome 拡張機能管理ページ)[chrome://extensions/] の ` パッケージ化されていない拡張機能を読み込む` から読み込む

## リリース作業

1. 以下のコマンドで zip ファイル作成

```sh
npm run build:prod
```

1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) から、対象の拡張を選択、「パッケージ」→「新しいパッケージのアップロード」で作成された `archive.zip` をアップロード

1. 入力事項を更新(optional)して、「アイテムを公開」

# SyncTabClipper
![icon128](https://user-images.githubusercontent.com/1401147/77155751-59807c80-6ae1-11ea-8441-3d892eb15769.png)

# about

「SyncTabClipper」はchromeで開いているタブを1つのページにまとめるChrome拡張です。

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

この拡張のアプリアイコンは[ICOON MONO様](https://icooon-mono.com/)の[「手帳のアイコン素材」](https://icooon-mono.com/11138-%e6%89%8b%e5%b8%b3%e3%81%ae%e3%82%a2%e3%82%a4%e3%82%b3%e3%83%b3%e7%b4%a0%e6%9d%90/)を使用しています。

## 使用しているライブラリ

- [UIkit](https://getuikit.com/)
- [zlib-js](http://www33146ue.sakura.ne.jp/staff/iz/release/zlib-js/zlib-js.html)


- [使用ライブラリのライセンスクレジット一覧](CREDITS)

## リリース作業

1. 以下のコマンドでzipファイル作成

```sh
git archive HEAD src --output=src.zip
```
1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) から、対象の拡張を選択、「パッケージ」→「新しいパッケージのアップロード」で作成したzipファイルをアップロード

1. 入力事項を更新(optional)して、「アイテムを公開」

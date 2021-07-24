const {merge} = require('webpack-merge')
const CopyPlugin = require("copy-webpack-plugin")
const common = require('./webpack.common.js') // 汎用設定をインポート
const path = require("path")

// common設定とマージする
module.exports = merge(common, {
    mode: 'development', // 開発モード
    devtool: 'inline-source-map', // 開発用ソースマップ
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    context: "src/images",
                    from: "*",
                    to: path.join(__dirname, "dist/images/"),
                },
            ],
        }),
    ],
})

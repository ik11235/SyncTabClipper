const {merge} = require('webpack-merge')
const CopyPlugin = require("copy-webpack-plugin")
const common = require('./webpack.common.js') // 汎用設定をインポート
const path = require("path")
const TerserPlugin = require('terser-webpack-plugin');


// common設定とマージする
module.exports = merge(common, {
    mode: 'production',
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            terserOptions: {
                ecma: 6,
                compress: true,
                output: {
                    comments: false,
                    beautify: false
                }
            }
        })]
    },
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

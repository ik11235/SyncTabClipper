const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    // モード値を production に設定すると最適化された状態で、
    // development に設定するとソースマップ有効でJSファイルが出力される
    devtool: 'cheap-module-source-map',
    mode: 'development',
    entry: {
        background: path.join(__dirname, "src/js/background.ts"),
        tabs: path.join(__dirname, "src/js/tabs.ts"),
    },
    output: {
        path: path.join(__dirname, "dist/js"),
        filename: "[name].js",
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {from: "src/tabs.html", to: path.join(__dirname, "dist/")},
                {from: "src/manifest.json", to: path.join(__dirname, "dist/")},
                {
                    context: "src/images",
                    from: "*",
                    to: path.join(__dirname, "dist/images/"),
                },
                {
                    context: "src/js",
                    from: "zlib*.js",
                    to: path.join(__dirname, "dist/js/"),
                },
                {
                    context: "src/css",
                    from: "uikit.min.css",
                    to: path.join(__dirname, "dist/css/"),
                },
            ],
        }),
    ],
};

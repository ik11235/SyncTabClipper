const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
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


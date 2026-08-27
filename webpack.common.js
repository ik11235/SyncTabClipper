const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    background: path.join(__dirname, 'src/js/background.ts'),
    tabs: path.join(__dirname, 'src/js/tabs.tsx'),
  },
  output: {
    path: path.join(__dirname, 'dist/js'),
    filename: '[name].js',
    // 動的importで切り出したチャンク(#237)に、数字のidではなく
    // webpackChunkNameで付けた名前を使う。dist/jsに素性の分からない
    // 900.jsのようなファイルが並ぶのを避ける
    chunkFilename: '[name].chunk.js',
    // チャンクの置き場を明示する。既定の'auto'はimportScriptsやdocumentから
    // 実行時に推測するランタイムを吐き、どちらも無い環境（module service
    // worker）ではバンドルの読み込み時点でthrowする。拡張のページも
    // service workerも同じオリジンなので、固定で指せる
    publicPath: '/js/',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.tsx$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: { url: false },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: path.join(__dirname, 'dist/') },
        {
          context: 'src/_locales',
          from: '*/*',
          to: path.join(__dirname, 'dist/_locales/'),
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: 'src/tabs.html',
      filename: '../tabs.html',
      chunks: ['tabs'],
      scriptLoading: 'defer',
    }),
  ],
};

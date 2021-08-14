const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: path.join(__dirname, 'src/js/background.ts'),
    tabs: path.join(__dirname, 'src/js/tabs.tsx'),
  },
  output: {
    path: path.join(__dirname, 'dist/js'),
    filename: '[name].js',
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
    extensions: ['.ts', '.js', '.tsx', 'jsx'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/tabs.html', to: path.join(__dirname, 'dist/') },
        { from: 'src/manifest.json', to: path.join(__dirname, 'dist/') },
        {
          context: 'src/js',
          from: 'zlib*.js',
          to: path.join(__dirname, 'dist/js/'),
        },
        {
          context: 'src/_locales',
          from: '*/*',
          to: path.join(__dirname, 'dist/_locales/'),
        },
      ],
    }),
  ],
};

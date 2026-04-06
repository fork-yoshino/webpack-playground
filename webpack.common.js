const path = require('path');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackWatchedGlobEntries = require('webpack-watched-glob-entries-plugin');

/**
 * 指定したパス配下のjsまたはtsファイルのファイル名とファイルのパスが入ったObjectを取得
 * 例) /ts/foo.ts => { foo: "/ts/foo.ts" }
 * ※ルートディレクトリ配下にディレクトリを切り、そこにjs,tsファイルを置いた場合、そのディレクトリは無視される
 * @param {string} entryPath エントリーポイントとするjs,tsまでの相対パス
 */
function getEntries(entryPath) {
  return WebpackWatchedGlobEntries.getEntries(
    [path.resolve(__dirname, `${entryPath}/**/*.{js,ts}`)],
    {
      ignore: path.resolve(__dirname, `${entryPath}/**/_*.{js,ts}`),
    },
  )();
}

const fs = require('fs');

/**
 * 指定したentriesと同名のテンプレートファイル（.pug または .html）を読み込みHtmlWebpackPluginを生成する
 * .pug ファイルが存在する場合はそちらを優先する
 * ※ルートディレクトリ配下にディレクトリを切り、そこにファイルを置いた場合、そのディレクトリは無視される
 * @param {object} entries { foo: "/ts/foo.ts" }のようなentryを表すオブジェクト
 * @param {string} srcPath 指定したいテンプレートファイルまでの相対パス
 */
function buildHtmlWebpackPlugins(entries, srcPath) {
  return Object.keys(entries).map((key) => {
    const pugPath = path.resolve(__dirname, `${srcPath}/${key}.pug`);
    const htmlPath = path.resolve(__dirname, `${srcPath}/${key}.html`);
    const template = fs.existsSync(pugPath) ? pugPath : htmlPath;

    return new HtmlWebpackPlugin({
      inject: 'body',
      filename: `${key}.html`,
      template,
      chunks: [key],
    });
  });
}

// 設定するエントリーポイントを作成
const entries = getEntries('./src/ts');

module.exports = {
  entry: entries,
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: './js/[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(sa|sc|c)ss$/i,
        // 配列の下から上の順に処理される
        use: [
          // cssファイルとして別ファイルに出力する
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                // ベンダープレフィックスを自動付与する
                plugins: [require('autoprefixer')({ grid: true })],
              },
            },
          },
          {
            loader: 'sass-loader',
            options: {
              api: 'modern-compiler',
            },
          },
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        generator: {
          filename: './assets/[name].[contenthash][ext]',
        },
        type: 'asset/resource',
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },
      {
        test: /\.pug$/i,
        loader: '@webdiscus/pug-loader',
      },
    ],
  },
  plugins: [
    new Dotenv(),
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash].css',
    }),
    ...buildHtmlWebpackPlugins(entries, './src/pages'),
  ],
  optimization: {
    // 複数エントリ間の共通モジュール（_common.tsなど）を自動で分離する。別チャンクとして1つにまとめられ、重複読み込みを防ぐ
    splitChunks: {
      chunks: 'all',
      // node_modulesのパッケージを別チャンク(vendors)に分離し、長期キャッシュを効かせる
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@assets': path.resolve(__dirname, './src/assets/'),
      '@scss': path.resolve(__dirname, './src/scss/'),
      '@ts': path.resolve(__dirname, './src/ts/'),
    },
  },
};

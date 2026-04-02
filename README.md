# webpack-playground

フロントエンド開発環境の学習用プロジェクト。
Webpack5を中心に、TypeScript・SCSS・Pug・ESLint・Prettierなどの構成を試せる環境です。

> 各技術の概念・仕組みの詳しい解説は [docs/frontend-tooling-guide.md](./docs/frontend-tooling-guide.md) を参照してください。

---

## このプロジェクトの構成

### ディレクトリ構造

```
.
├── .browserslistrc          # 対象ブラウザの定義（Autoprefixer が参照）
├── .env                     # 環境変数（.gitignore 対象）
├── .env.example             # 環境変数のテンプレート（Git に含める）
├── .editorconfig            # エディタ共通設定（インデント・改行など）
├── .husky/
│   └── pre-commit           # Git pre-commit フック（lint-staged 実行）
├── .prettierrc              # Prettier の設定
├── .stylelintrc.json        # Stylelint の設定（SCSS + プロパティ順序）
├── eslint.config.js         # ESLint v9 Flat Config
├── tsconfig.json            # TypeScript の設定
├── package.json             # パッケージ管理・スクリプト定義
├── pnpm-lock.yaml           # パッケージのバージョン固定
├── webpack.common.js        # Webpack 共通設定
├── webpack.dev.js           # Webpack 開発用設定
├── webpack.prod.js          # Webpack 本番用設定
└── src/
    ├── env.d.ts              # 環境変数の型定義
    ├── ts/
    │   ├── index.ts          # エントリポイント（ルートページ）
    │   ├── about/
    │   │   └── index.ts      # エントリポイント（下階層ページ）
    │   └── common/
    │       └── _common.ts    # 共通モジュール（_ プレフィックスでエントリ除外）
    ├── pages/
    │   ├── index.html        # HTML テンプレート（ルートページ）
    │   └── about/
    │       └── index.pug     # Pug テンプレート（下階層ページ）
    ├── scss/
    │   ├── styles.scss       # ルートページ用スタイル
    │   └── about/
    │       └── about.scss    # About ページ用スタイル
    └── assets/
        └── dell-laptop.jpg   # 画像アセット
```

### npmスクリプト

```bash
pnpm dev       # 開発サーバー起動（http://localhost:8080）
pnpm build     # 本番ビルド（dist/ に出力）
pnpm lint          # ESLint でコード検査
pnpm lint:fix      # ESLint で自動修正
pnpm stylelint     # Stylelint で CSS/SCSS を検査
pnpm stylelint:fix # Stylelint で自動修正
pnpm format        # Prettier でコード整形
pnpm fix           # format + lint:fix + stylelint:fix を順番に実行
```

### セットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd webpack-playground

# 依存パッケージをインストール
pnpm install

# 環境変数ファイルを作成
cp .env.example .env

# 開発サーバーを起動
pnpm dev
```

### ビルドの流れ

```
1. pnpm build 実行
2. Webpack が webpack.prod.js を読み込み（webpack.common.js とマージ）
3. エントリポイント（src/ts/index.ts）から依存解析を開始
4. 各ファイルを対応する Loader で変換:
   - .ts  → ts-loader → JavaScript
   - .scss → sass-loader → postcss-loader → css-loader → CSS
   - .jpg  → asset/resource → ファイルコピー
   - .html → html-loader → リソース参照を解決
5. Plugin が後処理を実行:
   - Dotenv → .env の値で process.env.XXX を文字列置換
   - HtmlWebpackPlugin → HTML に JS/CSS の参照を挿入
   - MiniCssExtractPlugin → CSS を別ファイルとして出力
6. mode: production により最適化:
   - Tree Shaking（未使用コードの除去）
   - Minification（コードの圧縮）
7. dist/ にファイルを出力（clean: true で事前にクリア）

dist/
├── index.html                          # ルートページ（HTML から生成）
├── about/
│   └── index.html                      # 下階層ページ（Pug から生成）
├── js/
│   ├── index.bundle.js                 # ルートページの JavaScript
│   └── about/
│       └── index.bundle.js             # About ページの JavaScript
├── css/
│   ├── index.[contenthash].css         # ルートページの CSS
│   └── about/
│       └── index.[contenthash].css     # About ページの CSS
└── assets/
    └── dell-laptop.[contenthash].jpg   # コピーされた画像
```

### Volta について

`package.json` に Volta の設定が含まれており、Volta がインストールされている環境では自動的に Node.js v22.22.2 が使用されます。

```jsonc
// package.json
"volta": {
  "node": "22.22.2"
}
```

---

## 目次

- [webpack-playground](#webpack-playground)
  - [このプロジェクトの構成](#このプロジェクトの構成)
    - [ディレクトリ構造](#ディレクトリ構造)
    - [npmスクリプト](#npmスクリプト)
    - [セットアップ](#セットアップ)
    - [ビルドの流れ](#ビルドの流れ)
    - [Volta について](#volta-について)
  - [目次](#目次)
  - [Webpack 設定の詳細](#webpack-設定の詳細)
    - [共通設定 (webpack.common.js)](#共通設定-webpackcommonjs)
      - [エントリーポイントの自動生成](#エントリーポイントの自動生成)
      - [HtmlWebpackPlugin の自動生成](#htmlwebpackplugin-の自動生成)
      - [出力設定](#出力設定)
      - [ローダー設定](#ローダー設定)
      - [プラグイン](#プラグイン)
      - [コード分割 (splitChunks)](#コード分割-splitchunks)
      - [パスエイリアス（resolve）](#パスエイリアスresolve)
    - [開発用設定 (webpack.dev.js)](#開発用設定-webpackdevjs)
    - [本番用設定 (webpack.prod.js)](#本番用設定-webpackprodjs)
  - [TypeScript](#typescript)
    - [tsconfig.json](#tsconfigjson)
    - [パスエイリアス](#パスエイリアス)
    - [環境変数の型定義](#環境変数の型定義)
  - [環境変数 (dotenv-webpack)](#環境変数-dotenv-webpack)
  - [テンプレートエンジン](#テンプレートエンジン)
    - [HTML](#html)
    - [Pug](#pug)
  - [スタイル (SCSS / PostCSS)](#スタイル-scss--postcss)
    - [Browserslist](#browserslist)
  - [Linter / Formater](#linter--formater)
    - [ESLint](#eslint)
    - [Prettier](#prettier)
    - [Stylelint](#stylelint)
    - [EditorConfig](#editorconfig)
  - [Git フック (Husky + lint-staged)](#git-フック-husky--lint-staged)

---

## Webpack 設定の詳細

設定ファイルは `webpack-merge` を使って **共通 (common)** ・**開発 (dev)** ・**本番 (prod)** の3つに分割されています。

### 共通設定 (webpack.common.js)

#### エントリーポイントの自動生成

`webpack-watched-glob-entries-plugin` を使って、`src/ts/` 配下の JS/TS ファイルを自動的にエントリーポイントとして登録します。

```js
// webpack.common.js
function getEntries(entryPath) {
  return WebpackWatchedGlobEntries.getEntries(
    [path.resolve(__dirname, `${entryPath}/**/*.{js,ts}`)],
    {
      ignore: path.resolve(__dirname, `${entryPath}/**/_*.{js,ts}`),
    },
  )();
}

const entries = getEntries('./src/ts');
```

**ポイント:**
- `src/ts/` 配下の `.js` / `.ts` ファイルが自動でエントリーポイントになる
- **ファイル名が `_` で始まるファイル（例: `_common.ts`）は除外される** → 共通モジュールはこの命名規則を使う
- ディレクトリ構造がそのまま出力パスに反映される（例: `src/ts/about/index.ts` → `dist/js/about/index.bundle.js`）

#### HtmlWebpackPlugin の自動生成

エントリーポイントと同名のテンプレートファイル（`.pug` または `.html`）を自動検出して `HtmlWebpackPlugin` を生成します。

```js
// webpack.common.js
function buildHtmlWebpackPlugins(entries, srcPath) {
  return Object.keys(entries).map((key) => {
    const pugPath = path.resolve(__dirname, `${srcPath}/${key}.pug`);
    const htmlPath = path.resolve(__dirname, `${srcPath}/${key}.html`);
    const template = fs.existsSync(pugPath) ? pugPath : htmlPath;

    return new HtmlWebpackPlugin({
      inject: 'body',            // <script> タグを <body> の末尾に挿入
      filename: `${key}.html`,   // 出力ファイル名
      template,                  // テンプレートファイルのパス
      chunks: [key],             // このページに紐づくエントリーのみ読み込む
    });
  });
}
```

**ポイント:**
- `.pug` ファイルが存在すればそちらを優先、なければ `.html` を使う
- `chunks: [key]` により、各ページには対応するエントリーポイントの JS/CSS だけが挿入される
- テンプレートファイルは `src/pages/` に配置し、エントリーポイントと同じ名前・ディレクトリ構造にする

**対応関係の例:**

| エントリー (`src/ts/`) | テンプレート (`src/pages/`) | 出力 (`dist/`) |
|---|---|---|
| `index.ts` | `index.html` | `index.html` |
| `about/index.ts` | `about/index.pug` | `about/index.html` |

#### 出力設定

```js
// webpack.common.js
output: {
  path: path.resolve(__dirname, './dist'),
  filename: './js/[name].bundle.js',
  clean: true,  // ビルド前に dist/ を自動クリーンアップ
},
```

- `[name]` にはエントリー名が入る（例: `index`, `about/index`）
- `clean: true` により古い出力ファイルが自動削除される

#### ローダー設定

```js
// webpack.common.js
module: {
  rules: [
    // TypeScript
    {
      test: /\.ts$/,
      use: 'ts-loader',
      exclude: /node_modules/,
    },
    // SCSS / CSS
    {
      test: /\.(sa|sc|c)ss$/i,
      use: [
        MiniCssExtractPlugin.loader,  // CSS を別ファイルとして出力
        'css-loader',                  // CSS の依存関係を解決
        {
          loader: 'postcss-loader',
          options: {
            postcssOptions: {
              plugins: [require('autoprefixer')({ grid: true })],
              // ↑ autoprefixer でベンダープレフィックスを自動付与
              //   grid: true で CSS Grid のプレフィックスも対応
            },
          },
        },
        {
          loader: 'sass-loader',
          options: {
            api: 'modern-compiler',  // Dart Sass の新しい API を使用
          },
        },
      ],
    },
    // 画像ファイル
    {
      test: /\.(png|jpe?g|gif|svg)$/i,
      generator: {
        filename: './assets/[name].[contenthash][ext]',
        // contenthash: ファイル内容に基づくハッシュ（キャッシュバスティング）
      },
      type: 'asset/resource',  // ファイルとして出力（file-loader 相当）
    },
    // HTML
    {
      test: /\.html$/i,
      loader: 'html-loader',  // HTML 内の画像パス等を解決
    },
    // Pug
    {
      test: /\.pug$/i,
      loader: '@webdiscus/pug-loader',  // Pug テンプレートをコンパイル
    },
  ],
},
```

**ローダーの処理順序（SCSS の場合）:**
Webpack のローダーは**下から上（右から左）**の順に実行されます。

```
sass-loader → postcss-loader → css-loader → MiniCssExtractPlugin.loader
    ↓              ↓                ↓                  ↓
 SCSS→CSS     autoprefixer    依存関係解決     別ファイルとして出力
```

#### プラグイン

```js
// webpack.common.js
plugins: [
  new Dotenv(),  // .env ファイルの値を process.env.* で参照可能にする
  new MiniCssExtractPlugin({
    filename: 'css/[name].[contenthash].css',
    // contenthash: CSS の内容が変わるとファイル名が変わる（キャッシュバスティング）
  }),
  ...buildHtmlWebpackPlugins(entries, './src/pages'),
],
```

#### コード分割 (splitChunks)

```js
// webpack.common.js
optimization: {
  splitChunks: {
    chunks: 'all',
    // 複数エントリー間の共通モジュールを自動的に別チャンクに分離する
    // 例: index.ts と about/index.ts の両方が _common.ts を import している場合、
    //     _common.ts の内容は共通チャンクとして1つのファイルにまとめられる
  },
},
```

#### パスエイリアス（resolve）

```js
// webpack.common.js
resolve: {
  extensions: ['.ts', '.js'],  // import 時に拡張子を省略可能にする
  alias: {
    '@assets': path.resolve(__dirname, './src/assets/'),
    '@scss': path.resolve(__dirname, './src/scss/'),
    '@ts': path.resolve(__dirname, './src/ts/'),
  },
},
```

これにより、深いディレクトリからでも相対パスを使わずにインポートできます。

```ts
// 相対パスの場合
import '@scss/styles.scss';         // ← エイリアスを使用
import '../../scss/styles.scss';    // ← 相対パスだと煩雑
```

---

### 開発用設定 (webpack.dev.js)

```js
// webpack.dev.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',    // 開発モード（圧縮なし、デバッグ向け）
  devtool: 'source-map',  // ソースマップを生成（ブラウザで元の TS/SCSS をデバッグ可能）
  devServer: {
    host: 'localhost',
    port: 8080,
    hot: true,             // Hot Module Replacement（ページ全体のリロードなしに変更を反映）
    open: true,            // 起動時にブラウザを自動で開く
  },
});
```

---

### 本番用設定 (webpack.prod.js)

```js
// webpack.prod.js
const { merge } = require('webpack-merge');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'production',  // 本番モード（JS の圧縮・Tree Shaking が有効）
  output: {
    filename: './js/[name].[contenthash].js',
    // 本番では contenthash を付与してキャッシュバスティング
    // ※ 開発時は [name].bundle.js（common の設定）でハッシュなし
  },
  optimization: {
    minimizer: [
      '...',  // Webpack デフォルトの minimizer（TerserPlugin: JS 圧縮）を維持
      new CssMinimizerPlugin(),  // CSS も圧縮
    ],
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',       // HTML ファイルとして出力（サーバーは起動しない）
      openAnalyzer: false,           // ビルド後にブラウザを自動で開かない
      reportFilename: '../report.html',  // プロジェクトルートに出力
    }),
  ],
});
```

**`'...'` (スプレッド構文) について:**
`optimization.minimizer` を指定すると、Webpack デフォルトの JS 圧縮 (TerserPlugin) が上書きされてしまいます。`'...'` を含めることで、デフォルトの minimizer を維持しつつ `CssMinimizerPlugin` を追加できます。

**Bundle Analyzer:**
`pnpm build` を実行すると、プロジェクトルートに `report.html` が生成されます。これをブラウザで開くと、バンドルの内容・サイズを視覚的に確認できます。

---

## TypeScript

### tsconfig.json

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",             // 出力する JavaScript のバージョン
    "module": "ESNext",             // ESM 形式のモジュール構文を使用
    "moduleResolution": "bundler",  // バンドラー（Webpack）に適した解決方式
    "strict": true,                 // 厳格な型チェックを有効化
    "esModuleInterop": true,        // CommonJS モジュールを ESM 風に import 可能に
    "skipLibCheck": true,           // 型定義ファイルのチェックをスキップ（ビルド高速化）
    "forceConsistentCasingInFileNames": true,  // ファイル名の大文字小文字を厳密にチェック
    "resolveJsonModule": true,      // JSON ファイルを import 可能にする
    "isolatedModules": true,        // ファイル単位でのトランスパイルを保証
    "baseUrl": ".",
    "paths": {
      "@assets/*": ["./src/assets/*"],
      "@scss/*": ["./src/scss/*"],
      "@ts/*": ["./src/ts/*"]
    }
  },
  "include": ["src"]
}
```

### パスエイリアス

パスエイリアスは **Webpack (`resolve.alias`) と TypeScript (`paths`) の両方** に設定する必要があります。

| 設定場所 | 役割 |
|---|---|
| `webpack.common.js` の `resolve.alias` | 実際のモジュール解決（ビルド時） |
| `tsconfig.json` の `paths` | エディタの補完・型チェック（開発時） |

両方に同じエイリアスを定義しないと、ビルドは通るがエディタでエラーが出る（またはその逆）という問題が起きます。

### 環境変数の型定義

```ts
// src/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    API_URL: string;
    APP_TITLE: string;
  }
}
```

`env.d.ts` で `process.env` の型を宣言することで、`process.env.API_URL` のように型安全に環境変数を参照できます。エディタの補完も有効になります。

---

## 環境変数 (dotenv-webpack)

`.env` ファイルに定義した値を `process.env.*` でアクセス可能にするプラグインです。

```bash
# .env.example（テンプレート）
API_URL=https://api.example.com
APP_TITLE=Webpack Playground
```

```ts
// src/ts/index.ts での使用例
console.log('API_URL:', process.env.API_URL);
console.log('APP_TITLE:', process.env.APP_TITLE);
```

**セットアップ手順:**

1. `.env.example` をコピーして `.env` を作成
2. `.env` に実際の値を記入
3. `.env` は `.gitignore` に含まれているため Git にはコミットされない

```js
// webpack.common.js
plugins: [
  new Dotenv(),  // デフォルトでプロジェクトルートの .env を読み込む
  // ...
],
```

---

## テンプレートエンジン

### HTML

```html
<!-- src/pages/index.html -->
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <h1>index.html</h1>
    <img src="../assets/dell-laptop.jpg" alt="Dell-Laptop" width="600" height="400" />
    <!-- ↑ html-loader が画像パスを解決し、asset/resource で dist/assets/ に出力される -->
    <!-- ↑ <script> タグは HtmlWebpackPlugin が inject: 'body' で自動挿入する -->
  </body>
</html>
```

`html-loader` により、HTML 内の `<img src="...">` などの参照が Webpack のモジュールシステムで解決されます。画像は `asset/resource` ルールにより `dist/assets/[name].[contenthash][ext]` として出力されます。

### Pug

```pug
//- src/pages/about/index.pug
doctype html
html(lang="ja")
  head
    meta(charset="UTF-8")
    meta(name="viewport" content="width=device-width, initial-scale=1.0")
    title About
  body
    h1 About Page
    p.about-description このページは about/index です。下階層のページが正しく動作するかを確認しています。
    a(href="../index.html") トップに戻る
```

Pug はインデントベースのテンプレートエンジンで、HTML をより簡潔に記述できます。`@webdiscus/pug-loader` によりコンパイルされます。

**新しいページの追加手順:**

1. `src/ts/<name>.ts` にエントリーポイントを作成
2. `src/pages/<name>.html` または `src/pages/<name>.pug` にテンプレートを作成
3. 必要に応じて `src/scss/<name>.scss` にスタイルを作成し、エントリーの TS から `import` する

自動検出により、Webpack の設定を変更する必要はありません。

---

## スタイル (SCSS / PostCSS)

SCSS ファイルは各エントリーポイントの TypeScript から `import` します。

```ts
// src/ts/index.ts
import '@scss/styles.scss';
```

```scss
// src/scss/styles.scss
h1 {
  color: blue;
}
```

```scss
// src/scss/about/about.scss
h1 {
  color: red;
}

.about-description {
  font-size: 18px;
  color: #333;
}
```

**ビルドの流れ:**

1. TypeScript の `import` により SCSS ファイルが Webpack の依存グラフに追加される
2. `sass-loader` が SCSS → CSS に変換
3. `postcss-loader` + `autoprefixer` がベンダープレフィックスを付与
4. `css-loader` が `@import` や `url()` を解決
5. `MiniCssExtractPlugin.loader` が CSS を別ファイルとして `dist/css/` に出力

### Browserslist

```bash
# .browserslistrc
last 1 version   # 各ブラウザの最新1バージョン
> 1%             # シェアが1%以上のブラウザ
not dead         # セキュリティアップデートがあるブラウザのみ
```

`autoprefixer` と `@babel/preset-env`（使用している場合）がこの設定を参照し、対象ブラウザに応じたプレフィックスやポリフィルを適用します。

---

## Linter / Formater

### ESLint

ESLint 9 の新しい **flat config** 形式を使用しています。

```js
// eslint.config.js
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', 'webpack.*.js', 'eslint.config.js'],
    // ↑ lint 対象から除外するファイル/ディレクトリ
  },
  js.configs.recommended,            // ESLint 推奨ルール
  ...tseslint.configs.recommended,   // TypeScript 推奨ルール
  prettierConfig,                    // Prettier と競合するルールを無効化
  {
    languageOptions: {
      parserOptions: {
        projectService: true,          // 型情報を使った高度な lint を有効化
        tsconfigRootDir: __dirname,
      },
    },
  },
);
```

**設定の適用順序:**
後から指定した設定が前の設定を上書きします。

```
js.configs.recommended → tseslint.configs.recommended → prettierConfig
```

`prettierConfig` を最後に置くことで、Prettier と競合する ESLint ルールを確実に無効化しています。

### Prettier

```jsonc
// .prettierrc
{
  "singleQuote": true,     // 文字列にシングルクォートを使用
  "trailingComma": "all",  // 末尾のカンマを常に付与
  "printWidth": 100         // 1行あたりの最大文字数
}
```

### Stylelint

```jsonc
// .stylelintrc.json
{
  "extends": [
    "stylelint-config-standard-scss",  // SCSS 対応の標準ルール
    "stylelint-config-recess-order"    // CSS プロパティの並び順を RECESS 基準で統一
  ]
}
```

**`stylelint-config-recess-order` について:**
CSS プロパティを以下のような論理的なグループ順で並べることを強制します。

```
position → display → box model → typography → visual → misc
```

### EditorConfig

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf                 # 改行コードを LF に統一
indent_style = space             # インデントにスペースを使用
indent_size = 2                  # インデント幅は2
insert_final_newline = true      # ファイル末尾に空行を挿入
trim_trailing_whitespace = true  # 行末の余分な空白を削除

[*.md]
trim_trailing_whitespace = false  # Markdown では行末空白に意味がある（改行）
```

EditorConfig は、エディタやIDEがこのファイルを読み取り、保存時に自動でフォーマットを適用する仕組みです。Prettier とは別に、エディタレベルでの一貫性を担保します。

---

## Git フック (Husky + lint-staged)

Git の `pre-commit` フックで、ステージングされたファイルに対してのみ Lint/Format を実行します。

```bash
# .husky/pre-commit
pnpm exec lint-staged
```

```jsonc
// package.json
"lint-staged": {
  "src/**/*.{js,ts}": [
    "prettier --write",   // まずフォーマット
    "eslint --fix"         // 次に lint + 自動修正
  ],
  "src/**/*.{css,scss}": [
    "prettier --write",
    "stylelint --fix"
  ],
  "src/**/*.html": [
    "prettier --write"
  ]
}
```

**動作の流れ:**

1. `git commit` を実行
2. Husky が `.husky/pre-commit` を実行
3. `lint-staged` がステージングされたファイルのみを対象に、ファイルタイプに応じたコマンドを実行
4. エラーがあればコミットが中断される

**`prepare` スクリプトについて:**

```jsonc
// package.json
"scripts": {
  "prepare": "husky"
}
```

`prepare` は `pnpm install` 後に自動実行される npm のライフサイクルスクリプトです。これにより、`pnpm install` するだけで Husky のセットアップが完了します。

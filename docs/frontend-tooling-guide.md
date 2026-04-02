# フロントエンドツール技術ガイド

このプロジェクトで使用しているフロントエンド開発ツールの技術解説です。
各ツールの概念・仕組み・設定の意図を備忘録としてまとめています。

> プロジェクトの構成・セットアップ・スクリプトについては [README.md](../README.md) を参照してください。

---

## 目次

- [1. なぜビルドツールが必要か](#1-なぜビルドツールが必要か)
  - [1.1 JavaScript モジュールの歴史](#11-javascript-モジュールの歴史)
  - [1.2 ブラウザがそのまま扱えないもの](#12-ブラウザがそのまま扱えないもの)
  - [1.3 なぜバンドルが必要だったのか](#13-なぜバンドルが必要だったのか)
- [2. パッケージ管理](#2-パッケージ管理)
- [3. Webpack の基本概念](#3-webpack-の基本概念)
  - [3.1 Entry（エントリ）](#31-entryエントリ)
  - [3.2 Output（アウトプット）](#32-outputアウトプット)
  - [3.3 Loader（ローダー）](#33-loaderローダー)
  - [3.4 Plugin（プラグイン）](#34-pluginプラグイン)
  - [3.5 Mode（モード）](#35-modeモード)
  - [3.6 DevServer](#36-devserver)
  - [3.7 webpack-merge による設定の分離](#37-webpack-merge-による設定の分離)
- [4. TypeScript と ts-loader](#4-typescript-と-ts-loader)
- [5. CSS / Sass の処理パイプライン](#5-css--sass-の処理パイプライン)
- [6. Pug テンプレートエンジン](#6-pug-テンプレートエンジン)
- [7. PostCSS・Browserslist・Autoprefixer](#7-postcss・browserslist・autoprefixer)
- [8. Polyfill と Babel](#8-polyfill-と-babel)
- [9. Code Splitting](#9-code-splitting)
- [10. Tree Shaking](#10-tree-shaking)
- [11. 環境変数](#11-環境変数)
- [12. Alias（パスエイリアス）](#12-aliasパスエイリアス)
- [13. ESLint](#13-eslint)
- [14. Prettier](#14-prettier)
- [15. ESLint と Prettier の共存](#15-eslint-と-prettier-の共存)
- [16. Stylelint](#16-stylelint)
- [17. EditorConfig](#17-editorconfig)
- [18. husky + lint-staged](#18-husky--lint-staged)
- [19. Volta](#19-volta)
- [20. Webpack と Vite の違い](#20-webpack-と-vite-の違い)

---

## 1. なぜビルドツールが必要か

### 1.1 JavaScript モジュールの歴史

JavaScript はもともとブラウザ上で短いスクリプトを実行するための言語だった。
アプリケーションが複雑になるにつれ、コードを複数ファイルに分割する「モジュール」の仕組みが必要になった。

#### モジュールシステムの変遷

| 時期 | 仕組み | 特徴 |
|---|---|---|
| 〜2009年 | グローバル変数 / IIFE | `<script>` タグを順番に並べて読み込む。名前空間の衝突が問題 |
| 2009年〜 | **CommonJS** (`require` / `module.exports`) | Node.js が採用。同期的な読み込みのためブラウザでは使えない |
| 2011年〜 | **AMD** (Asynchronous Module Definition) | ブラウザ向け非同期モジュール。RequireJS が代表的な実装 |
| 2015年〜 | **ES Modules** (`import` / `export`) | ECMAScript 仕様に正式採用。静的解析が可能 |

```js
// CommonJS（Node.js）
const path = require('path');
module.exports = { foo: 'bar' };

// ES Modules（現在の標準）
import path from 'path';
export const foo = 'bar';
```

#### ES Modules の特徴

- **静的な構文**: `import` / `export` はファイルのトップレベルに書く必要があり、条件分岐の中では使えない。これにより、ビルドツールがコードを実行せずに依存関係を解析できる（= Tree Shaking が可能になる）
- **ブラウザネイティブサポート**: `<script type="module">` でブラウザから直接読み込めるようになった
- **非同期読み込み**: `import()` による動的インポートで、必要な時に必要なモジュールだけを読み込める

```html
<!-- ブラウザでES Modulesを直接使う場合 -->
<script type="module" src="./main.js"></script>
```

しかし、ブラウザで ES Modules を直接使う場合、ファイルごとに HTTP リクエストが発生するため、多数のモジュールがある場合はパフォーマンスの問題が生じる。これがバンドラーが必要な理由の一つ。

### 1.2 ブラウザがそのまま扱えないもの

ブラウザが理解できるのは **HTML / CSS / JavaScript** の3つだけ。
以下のような技術はそのままではブラウザで動かないため、ビルドツールによる変換（トランスパイル）が必要になる。

| 技術 | 変換先 | このプロジェクトでの対応 |
|---|---|---|
| **TypeScript** | JavaScript | `ts-loader` が変換 |
| **Sass / SCSS** | CSS | `sass-loader` → `postcss-loader` → `css-loader` → `MiniCssExtractPlugin` |
| **JSX / TSX** | JavaScript | このプロジェクトでは未使用（Reactプロジェクトで使用） |
| **最新のES構文** | 古いブラウザ向けJS | Babel が担当（このプロジェクトでは未導入） |

### 1.3 なぜバンドルが必要だったのか

バンドルとは、複数のファイルを1つ（または少数）のファイルにまとめることを指す。

#### バンドルが必要な理由

1. **HTTP リクエストの削減**
   - HTTP/1.1 ではブラウザが同時に開ける接続数に制限がある（通常6接続）
   - 100個のJSファイルを個別にリクエストすると、大きな遅延が発生する
   - 1つにまとめれば1回のリクエストで済む

2. **依存関係の解決**
   - モジュール間の依存関係（AがBを使い、BがCを使う...）を正しい順序で解決する必要がある
   - バンドラーが依存グラフを構築し、適切な順序でコードをまとめる

3. **ブラウザ互換性の確保**
   - TypeScriptやSassなど、ブラウザが理解できないコードを変換する
   - 古いブラウザ向けにコードを変換する（Polyfill / Babel）

4. **最適化**
   - 未使用コードの除去（Tree Shaking）
   - コードの圧縮（Minification）
   - 画像やフォントの最適化

> **補足: HTTP/2 時代のバンドル**
> HTTP/2 では多重化（Multiplexing）により同時リクエスト数の制限が事実上なくなった。
> しかし、バンドルには依存解決・変換・最適化という役割があり、依然として必要とされている。
> ただし「すべてを1ファイルにまとめる」必要性は薄れ、適切な粒度での Code Splitting が重要になっている。

---

## 2. パッケージ管理

### パッケージマネージャー

Node.js のパッケージ管理ツール。主に npm、Yarn、pnpm の3つがある。

| ツール | 特徴 |
|---|---|
| **npm** | Node.js に同梱。追加インストール不要。最も広く使われている |
| **Yarn** | npm の代替として登場。v2 以降は PnP（Plug'n'Play）という独自の仕組みを持つ |
| **pnpm** | ハードリンクでディスク効率が高い。依存管理が厳格。モダンなプロジェクトで採用増 |

このプロジェクトでは **pnpm** を使用している。

```bash
# パッケージのインストール
pnpm install              # package.json に基づいて全パッケージをインストール
pnpm add lodash           # dependencies に追加
pnpm add -D webpack       # devDependencies に追加（本番には含まれない）
```

### pnpm の特徴

pnpm は `node_modules` を作成するが、内部的にはグローバルストア（`~/.local/share/pnpm/store`）にパッケージを1つだけ保存し、各プロジェクトからはハードリンクで参照する。

```
# npm / Yarn: プロジェクトごとにパッケージのコピーを持つ
project-a/node_modules/lodash/  → 70KB
project-b/node_modules/lodash/  → 70KB（重複）

# pnpm: グローバルストアに1つだけ保存し、ハードリンクで参照
~/.local/share/pnpm/store/lodash/  → 70KB（実体は1つ）
project-a/node_modules/lodash/     → ハードリンク
project-b/node_modules/lodash/     → ハードリンク
```

また、pnpm は**厳格な依存管理**を行う。npm や Yarn では `package.json` に書いていないパッケージも `node_modules` から `require` できてしまうが（幽霊依存）、pnpm ではこれを防止する。

### package.json の構造

```json
{
  "name": "app",
  "private": true,          // npm に公開しない
  "scripts": {              // pnpm dev のようにコマンドとして実行できる
    "dev": "webpack serve --config webpack.dev.js",
    "build": "webpack --config webpack.prod.js"
  },
  "devDependencies": {      // 開発時のみ必要なパッケージ
    "webpack": "^5.97.1"
  }
}
```

### dependencies vs devDependencies

| 種別 | 用途 | 例 |
|---|---|---|
| `dependencies` | 本番実行時にも必要 | React, Express, lodash |
| `devDependencies` | 開発・ビルド時のみ必要 | webpack, eslint, typescript |

このプロジェクトはビルドして静的ファイルを生成するだけなので、すべて `devDependencies` に入れている。ライブラリとして公開する場合やサーバーサイドレンダリングの場合は区別が重要になる。

### バージョン指定の記法

```
"webpack": "^5.97.1"   // ^（キャレット）: 5.x.x の最新を許容（メジャーは固定）
"typescript": "~5.7.0"  // ~（チルダ）: 5.7.x の最新を許容（マイナーも固定）
"lodash": "4.17.21"     // 完全固定
```

このプロジェクトでは TypeScript のバージョンを `~5.7.0` としている。TypeScript はマイナーバージョンでも破壊的変更が入ることがあるため、チルダで範囲を狭めている。

### ロックファイル（pnpm-lock.yaml）

`pnpm-lock.yaml` は実際にインストールされたパッケージの正確なバージョンを記録するファイル。
`package.json` の `^5.97.1` は「5.97.1 以上 6.0.0 未満」という範囲指定だが、ロックファイルは「5.105.4」のように確定したバージョンを記録する。これにより、チームメンバー全員が同じバージョンのパッケージを使うことが保証される。

| パッケージマネージャー | ロックファイル |
|---|---|
| npm | `package-lock.json` |
| Yarn | `yarn.lock` |
| pnpm | `pnpm-lock.yaml` |

---

## 3. Webpack の基本概念

Webpack はモジュールバンドラー。JavaScript を起点に、依存する CSS・画像・HTML などのあらゆるアセットを解析し、ブラウザが実行可能な静的ファイルに変換・結合する。

### 3.1 Entry（エントリ）

Webpack が依存関係の解析を開始する起点となるファイル。

```js
// webpack.common.js（このプロジェクト）
module.exports = {
  entry: entries,  // { index: './src/ts/index.ts' } のようなオブジェクト
};
```

このプロジェクトでは `webpack-watched-glob-entries-plugin` を使って `src/ts/` 配下のファイルを自動検出している。
`_` プレフィックスのファイル（例: `_common.ts`）は共通モジュールとしてエントリからは除外される。

```
src/ts/
├── index.ts            ← エントリポイント（自動検出）
└── common/
    └── _common.ts      ← _ プレフィックスなのでエントリから除外
```

`index.ts` の内容:
```ts
import '@scss/styles.scss';          // Sassファイルを読み込み（CSSとして出力される）
import { common } from './common/_common';  // 共通モジュールを読み込み

console.log('テスト');
console.log('API_URL:', process.env.API_URL);      // 環境変数の参照
console.log('APP_TITLE:', process.env.APP_TITLE);
common();
```

ここから Webpack は依存グラフを構築する:
```
index.ts
├── styles.scss    → sass-loader → postcss-loader → css-loader → CSSファイルとして出力
└── _common.ts     → ts-loader → JSにバンドル
```

### 3.2 Output（アウトプット）

バンドル結果の出力先。

```js
output: {
  path: path.resolve(__dirname, './dist'),      // 出力ディレクトリ（絶対パス）
  filename: './js/[name].bundle.js',            // 出力ファイル名
  clean: true,                                  // ビルド前に dist/ を自動削除
},
```

- `[name]` はエントリ名に置換される（例: `index.bundle.js`）
- `[contenthash]` を使うとファイル内容に基づくハッシュが付与され、ブラウザキャッシュの制御に使える
- `clean: true` は Webpack 5 の組み込み機能。以前は `clean-webpack-plugin` が必要だった

### 3.3 Loader（ローダー）

Webpack は本来 JavaScript と JSON しか理解できない。
Loader はそれ以外のファイル（TypeScript, CSS, 画像など）を Webpack が扱えるモジュールに変換する仕組み。

```js
module: {
  rules: [
    {
      test: /\.ts$/,           // 対象ファイルの正規表現
      use: 'ts-loader',        // 使用するLoader
      exclude: /node_modules/, // 除外パターン
    },
  ],
},
```

#### このプロジェクトで使っている Loader

| Loader | 役割 |
|---|---|
| `ts-loader` | TypeScript → JavaScript に変換 |
| `sass-loader` | Sass/SCSS → CSS に変換 |
| `postcss-loader` | PostCSS を通して CSS を後処理（Autoprefixer など） |
| `css-loader` | CSS 内の `@import` や `url()` を解決し、JavaScript モジュールに変換 |
| `html-loader` | HTML 内の `<img src="...">` などのリソース参照を解決 |
| `@webdiscus/pug-loader` | Pug テンプレートを HTML に変換 |

#### Loader チェーン（処理順序）

Loader は **配列の末尾から先頭へ** 順番に実行される。

```js
{
  test: /\.(sa|sc|c)ss$/i,
  use: [
    MiniCssExtractPlugin.loader,  // 4. CSSを別ファイルとして出力
    'css-loader',                  // 3. CSSをJSモジュールに変換
    'postcss-loader',              // 2. PostCSSで後処理（Autoprefixer）
    'sass-loader',                 // 1. 最初に実行: Sass → CSS に変換
  ],
},
```

処理の流れ:
```
styles.scss
  → [sass-loader]    Sass構文をCSSに変換
  → [postcss-loader] ベンダープレフィックスを付与
  → [css-loader]     @importやurl()を解決、JSモジュール化
  → [MiniCssExtractPlugin.loader]  別ファイルとして出力
```

#### Asset Modules（Webpack 5）

Webpack 5 ではファイルの読み込みに専用の Asset Modules が使える。
以前は `file-loader` や `url-loader` が必要だったが、Webpack 5 で組み込みになった。

```js
{
  test: /\.(png|jpe?g|gif|svg)$/i,
  generator: {
    filename: './assets/[name].[contenthash][ext]',
  },
  type: 'asset/resource',  // ファイルをそのまま出力し、URLを返す
},
```

| type | 動作 | 旧Loader相当 |
|---|---|---|
| `asset/resource` | ファイルを出力し、URLを返す | `file-loader` |
| `asset/inline` | Base64エンコードしてインライン化 | `url-loader` (limit超過時) |
| `asset` | サイズに応じて自動判定 | `url-loader` |

### 3.4 Plugin（プラグイン）

Loader がファイル単位の変換を担うのに対し、Plugin はバンドルプロセス全体に対して機能を追加する。

```js
plugins: [
  new MiniCssExtractPlugin({
    filename: 'css/[name].[contenthash].css',
  }),
  ...buildHtmlWebpackPlugins(entries, './src/pages'),
],
```

#### このプロジェクトで使っている Plugin

| Plugin | 役割 |
|---|---|
| `Dotenv` (`dotenv-webpack`) | `.env` ファイルの環境変数をビルド時に `process.env.XXX` へ埋め込む |
| `HtmlWebpackPlugin` | HTML テンプレートにバンドルされた JS/CSS を自動で `<script>` / `<link>` タグとして挿入 |
| `MiniCssExtractPlugin` | CSS を JS から分離し、独立した `.css` ファイルとして出力 |

#### Loader と Plugin の違い

| | Loader | Plugin |
|---|---|---|
| **対象** | 個々のファイル | ビルドプロセス全体 |
| **設定場所** | `module.rules` | `plugins` |
| **役割** | ファイル変換 | バンドルの最適化、アセット管理、環境変数注入など |
| **例** | `.ts` → `.js` に変換 | HTMLに `<script>` タグを挿入 |

#### HtmlWebpackPlugin の動作

このプロジェクトでは、エントリポイントと同名の HTML ファイルを `src/pages/` から自動的に見つけて紐づけている。

```js
// エントリ: { index: './src/ts/index.ts' }
// → src/pages/index.html をテンプレートとして使用
// → dist/index.html を出力（JS/CSSの参照が自動挿入される）
```

ビルド前（`src/pages/index.html`）:
```html
<body>
  <h1>index.html</h1>
</body>
```

ビルド後（`dist/index.html`）:
```html
<body>
  <h1>index.html</h1>
  <!-- HtmlWebpackPlugin が自動挿入 -->
  <script src="./js/index.bundle.js"></script>
  <link href="css/index.abc123.css" rel="stylesheet">
</body>
```

### 3.5 Mode（モード）

Webpack のビルドモード。設定するだけで各種最適化が切り替わる。

| mode | 動作 |
|---|---|
| `development` | ソースマップ有効、読みやすいバンドル、高速なリビルド |
| `production` | コード圧縮（Minification）、Tree Shaking、最適化が自動で有効になる |

```js
// webpack.prod.js
module.exports = merge(common, {
  mode: 'production',  // これだけで圧縮・最適化が有効に
});
```

`production` モードでは内部的に `TerserPlugin`（JS圧縮）などが自動的に適用される。

### 3.6 DevServer

`webpack-dev-server` は開発用のローカルサーバー。ファイルの変更を監視し、自動でリビルド・ブラウザリロードを行う。

```js
// webpack.dev.js
devServer: {
  host: '0.0.0.0',    // 外部からのアクセスを許可
  port: 8080,          // ポート番号
  hot: true,           // Hot Module Replacement（後述）
  open: true,          // サーバー起動時にブラウザを自動で開く
  static: [
    {
      directory: path.resolve(__dirname, 'dist'),
    },
  ],
},
```

#### Hot Module Replacement（HMR）

HMR はページ全体をリロードせずに、変更されたモジュールだけを差し替える機能。

- **通常のリロード**: ページ全体を再読み込み → 状態（フォーム入力値など）がリセットされる
- **HMR**: 変更されたモジュールだけを差し替え → 状態を保持したまま更新

Webpack 5 の `webpack-dev-server` ではデフォルトで有効だが、`hot: true` で明示的に設定している。

#### Source Map

```js
devtool: 'source-map',
```

ソースマップは、バンドル・圧縮されたコードと元のソースコードの対応関係を記録するファイル。
ブラウザの開発者ツールで元の TypeScript / Sass ファイルの行番号でデバッグできるようになる。

| 設定値 | ビルド速度 | 品質 | 用途 |
|---|---|---|---|
| `source-map` | 遅い | 高品質 | 開発時に推奨 |
| `eval-source-map` | 速い | 中品質 | 高速な開発が必要な場合 |
| `hidden-source-map` | 遅い | 高品質 | 本番（ソースマップは出力するがユーザーには見せない） |
| （なし） | 最速 | なし | 本番（ソースマップ不要の場合） |

### 3.7 webpack-merge による設定の分離

このプロジェクトでは設定を3つのファイルに分離している。

```
webpack.common.js  ← 共通設定（Entry, Output, Loader, Plugin）
webpack.dev.js     ← 開発用設定（DevServer, Source Map）
webpack.prod.js    ← 本番用設定（mode: production）
```

`webpack-merge` は2つの設定オブジェクトをディープマージする。

```js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'production',
  // common の設定に production 固有の設定をマージ
});
```

通常の `Object.assign` や `{ ...spread }` では配列（`rules` や `plugins`）が上書きされてしまうが、`webpack-merge` は配列を結合してくれる。

---

## 4. TypeScript と ts-loader

### TypeScript とは

TypeScript は JavaScript に**静的型付け**を追加した言語。ブラウザは TypeScript を直接実行できないため、JavaScript にトランスパイルする必要がある。

### ts-loader の役割

`ts-loader` は Webpack のローダーとして TypeScript をコンパイルする。内部で TypeScript コンパイラ（`tsc`）を使用している。

```js
// webpack.common.js
{
  test: /\.ts$/,
  use: 'ts-loader',
  exclude: /node_modules/,
},
```

### tsconfig.json の各設定

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
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

| オプション | 説明 |
|---|---|
| `target` | 出力する JavaScript のバージョン。`ES2020` は Optional Chaining (`?.`) などが使える |
| `module` | モジュールの出力形式。Webpack がバンドルするため `ESNext`（ES Modules）が最適。`commonjs` だと Tree Shaking が効かない |
| `moduleResolution` | モジュール解決のアルゴリズム。`bundler` はバンドラー使用時に最適化された設定（TypeScript 5.0+） |
| `strict` | すべての厳格な型チェックオプションを有効にする |
| `esModuleInterop` | CommonJS モジュールを ES Modules の `import` 構文で読み込めるようにする |
| `skipLibCheck` | `.d.ts` ファイル（型定義）の型チェックをスキップ。ビルド速度の改善 |
| `isolatedModules` | 各ファイルを独立してトランスパイルできることを保証する。Babel や esbuild との互換性のため |
| `paths` | パスエイリアス（`@ts/` → `./src/ts/`）。エディタの補完・型チェックに使用 |

---

## 5. CSS / Sass の処理パイプライン

### Sass（SCSS）とは

Sass は CSS を拡張したメタ言語。変数・ネスト・ミックスイン・関数などが使える。
SCSS 記法は CSS と互換性のある構文で、`.scss` 拡張子を使う。

```scss
// 変数
$primary-color: blue;

// ネスト
h1 {
  color: $primary-color;

  &:hover {
    color: darken($primary-color, 10%);
  }
}
```

### sass-loader の設定

```js
{
  loader: 'sass-loader',
  options: {
    api: 'modern-compiler',  // Dart Sass の新しいコンパイラAPI（高速）
  },
},
```

`api: 'modern-compiler'` は Dart Sass の最新コンパイラ API を使用する設定。
以前は `implementation: require('sass')` と書いていたが、現在は非推奨。

### MiniCssExtractPlugin

```js
// Loaderチェーンの先頭（最後に実行される）
MiniCssExtractPlugin.loader,

// Pluginとしても設定
new MiniCssExtractPlugin({
  filename: 'css/[name].[contenthash].css',
}),
```

CSS を JavaScript バンドルから分離し、独立した `.css` ファイルとして出力する。
これにより、CSS と JS を並列で読み込めるようになり、初回表示が高速化する。

`[contenthash]` はファイル内容のハッシュ値。CSSの中身が変わらなければハッシュも変わらないため、ブラウザキャッシュを効率的に利用できる。

---

## 6. Pug テンプレートエンジン

### Pug とは

Pug（旧名: Jade）は HTML を簡潔に記述できるテンプレートエンジン。
インデントベースの構文で、閉じタグが不要になり、記述量が大幅に減る。

### HTML との比較

```html
<!-- HTML -->
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <h1>index.html</h1>
    <img src="../assets/dell-laptop.jpg" alt="Dell-Laptop" width="600" height="400" />
  </body>
</html>
```

```pug
//- Pug（同じ出力を得られる）
doctype html
html(lang="ja")
  head
    meta(charset="UTF-8")
    meta(name="viewport" content="width=device-width, initial-scale=1.0")
    title Document
  body
    h1 index.pug
    img(src=require("@assets/dell-laptop.jpg") alt="Dell-Laptop" width="600" height="400")
```

### Pug の基本構文

```pug
//- タグ（閉じタグ不要。インデントで親子関係を表現）
div
  h1 タイトル
  p テキスト

//- 属性（括弧内に記述）
a(href="https://example.com" target="_blank") リンク
img(src="image.jpg" alt="画像")

//- クラスとID（CSSセレクタと同じ記法）
div.container
  h1#title タイトル
  p.text.bold テキスト
//- → <div class="container"><h1 id="title">タイトル</h1><p class="text bold">テキスト</p></div>

//- 変数と式の埋め込み
- const name = "World"
h1 Hello #{name}
//- → <h1>Hello World</h1>

//- 条件分岐
- const isLoggedIn = true
if isLoggedIn
  p ログイン中
else
  p 未ログイン

//- ループ
ul
  each item in ["Apple", "Banana", "Cherry"]
    li= item

//- インクルード（別ファイルの読み込み）
include ./partials/_header.pug
main
  h1 メインコンテンツ
include ./partials/_footer.pug

//- ミックスイン（再利用可能なブロック）
mixin card(title, text)
  div.card
    h2= title
    p= text

+card("タイトル1", "テキスト1")
+card("タイトル2", "テキスト2")
```

### Webpack での設定

#### Loader

```js
// webpack.common.js
{
  test: /\.pug$/i,
  loader: '@webdiscus/pug-loader',
},
```

`@webdiscus/pug-loader` は Pug 3 に対応したローダー。旧来の `pug-loader` は Pug 2 までしか対応していない。

#### テンプレートの自動検出と HTML / Pug の共存

このプロジェクトでは `buildHtmlWebpackPlugins` が `.pug` と `.html` の両方に対応している。
同名のファイルがある場合は `.pug` を優先し、なければ `.html` にフォールバックする。

```js
// webpack.common.js
function buildHtmlWebpackPlugins(entries, srcPath) {
  return Object.keys(entries).map((key) => {
    const pugPath = path.resolve(__dirname, `${srcPath}/${key}.pug`);
    const htmlPath = path.resolve(__dirname, `${srcPath}/${key}.html`);
    const template = fs.existsSync(pugPath) ? pugPath : htmlPath;

    return new HtmlWebpackPlugin({
      inject: 'body',
      filename: `${key}.html`,
      template,  // .pug でも .html でも HtmlWebpackPlugin が処理
      chunks: [key],
    });
  });
}
```

これにより、**同一プロジェクト内で `.html` と `.pug` を混在させることができる**。
このプロジェクトでは実際にルートページを HTML、サブディレクトリのページを Pug で作成し、共存を確認している。

```
src/pages/
├── index.html             ← HTML で記述（ルートページ）
└── about/
    └── index.pug          ← Pug で記述（下階層ページ）
```

| ページ | テンプレート | 出力先 |
|---|---|---|
| ルート | `src/pages/index.html` | `dist/index.html` |
| About | `src/pages/about/index.pug` | `dist/about/index.html` |

既存の HTML ページを Pug に一括移行する必要はなく、新しいページだけ Pug で書くといった段階的な導入が可能。

#### 画像の参照

Pug テンプレート内で画像を参照する場合、`require()` を使うことで Webpack のアセット処理（ファイルコピー + contenthash 付与）が適用される。

```pug
//- Webpack のエイリアスと require() を使って画像を参照
img(src=require("@assets/dell-laptop.jpg") alt="Dell-Laptop" width="600" height="400")
```

ビルド後:
```html
<img src="./assets/dell-laptop.27616ba9360b24fbb60f.jpg" alt="Dell-Laptop" width="600" height="400">
```

### なぜ Pug を使うのか

| メリット | 説明 |
|---|---|
| **記述量の削減** | 閉じタグ不要、属性の括弧記法で HTML より簡潔 |
| **インクルード** | ヘッダー・フッターなどの共通パーツを分離して再利用できる |
| **ミックスイン** | コンポーネントのような再利用可能なブロックを定義できる |
| **ロジックの埋め込み** | 条件分岐・ループが使え、動的な HTML 生成が可能 |

| デメリット | 説明 |
|---|---|
| **学習コスト** | HTML とは異なる構文を覚える必要がある |
| **インデントに厳密** | インデントのズレがそのまま構造の崩れになる |
| **エディタ対応** | HTML ほどエディタのサポートが充実していない場合がある |

> **補足**: React / Vue などのコンポーネントベースのフレームワークを使う場合、テンプレートエンジンの役割はフレームワーク側が担うため、Pug の出番は減る。Pug は主にフレームワークを使わない静的サイトやマルチページサイトで有用。

---

## 7. PostCSS・Browserslist・Autoprefixer

### PostCSS とは

PostCSS は CSS を変換するためのツール。それ自体は何もせず、プラグインを組み合わせて使う。
JavaScript でいう Babel のような存在。

### Autoprefixer

CSS プロパティにベンダープレフィックスを自動付与するプラグイン。

```js
// webpack.common.js
{
  loader: 'postcss-loader',
  options: {
    postcssOptions: {
      plugins: [require('autoprefixer')({ grid: true })],
    },
  },
},
```

`{ grid: true }` は CSS Grid のプレフィックスも付与する設定。

変換前:
```css
.container {
  display: grid;
  user-select: none;
}
```

変換後:
```css
.container {
  display: -ms-grid;     /* IE 向け */
  display: grid;
  -webkit-user-select: none;  /* Safari 向け */
  -moz-user-select: none;     /* Firefox 向け */
  user-select: none;
}
```

### Browserslist

対象ブラウザを定義する設定ファイル。Autoprefixer や Babel がこの設定を参照して、どのブラウザ向けの変換が必要かを判断する。

```
# .browserslistrc（このプロジェクト）
last 1 version
> 1%
not dead
```

| 条件 | 意味 |
|---|---|
| `last 1 version` | 各ブラウザの最新1バージョン |
| `> 1%` | 世界シェア1%以上のブラウザ |
| `not dead` | 公式サポートが終了していないブラウザ |

これらは AND 条件ではなく OR 条件（いずれかに該当すれば対象）。

現在の対象ブラウザは以下のコマンドで確認できる:
```bash
npx browserslist
```

---

## 8. Polyfill と Babel

### Polyfill とは

古いブラウザに存在しない **API（機能）** を後から追加するコード。

例: `Array.prototype.includes()` は ES2016 で追加されたメソッド。IE11 にはこのメソッドが存在しないため、Polyfill で同等の関数を定義する。

```js
// Polyfill の概念（簡略化）
if (!Array.prototype.includes) {
  Array.prototype.includes = function(element) {
    return this.indexOf(element) !== -1;
  };
}
```

### Babel とは

Babel は JavaScript のトランスパイラ。**新しい構文（文法）** を古いブラウザでも動く構文に変換する。

```js
// 変換前（ES2020: Optional Chaining）
const name = user?.profile?.name;

// 変換後（ES5相当）
const name = user != null
  && user.profile != null
  ? user.profile.name
  : undefined;
```

### Polyfill と Babel の違い

| | Polyfill | Babel |
|---|---|---|
| **対象** | API（メソッド・オブジェクト） | 構文（文法） |
| **例** | `Promise`, `fetch`, `Array.includes` | `?.`（Optional Chaining）, `??`（Nullish Coalescing）, アロー関数 |
| **仕組み** | 不足している機能をランタイムに追加 | コードを古い構文に書き換え |

### このプロジェクトでの扱い

このプロジェクトでは **Polyfill も Babel も導入していない**。理由は以下の通り:

1. **`tsconfig.json` の `target: "ES2020"`** により、TypeScript コンパイラが ES2020 相当の JavaScript を出力する
2. **`.browserslistrc` の対象ブラウザ**（`last 1 version`, `> 1%`, `not dead`）はすべて ES2020 をサポートしている
3. **IE11 は対象外**（2022年にサポート終了済み）

つまり、出力する JS のバージョンと対象ブラウザのサポート範囲が一致しているため、Babel による構文変換も Polyfill による API 補完も不要。

#### 導入が必要になるケース

- 古いブラウザ（例: 特定の業務端末で古い Chrome が固定されている）をサポートする必要が出た場合
- `target` を下げて古い構文で出力する必要が出た場合

```bash
# 必要になった場合のインストールコマンド
pnpm add -D babel-loader @babel/core @babel/preset-env
```

---

## 9. Code Splitting

Code Splitting は、バンドルを複数のチャンク（ファイル）に分割する手法。
ページの初回読み込みに必要なコードだけを最初に読み込み、残りは必要になった時に読み込む。

### 分割の方法

#### 1. 複数エントリポイント

このプロジェクトで採用している方法。ページごとに異なるエントリポイントを持つ。

```js
// webpack.common.js
entry: {
  index: './src/ts/index.ts',
  // about: './src/ts/about.ts',  // ページを追加する場合
},
```

#### 2. Dynamic Import（動的インポート）

`import()` 関数を使ってモジュールを非同期で読み込む。Webpack が自動的に別チャンクに分割する。

```js
// 通常のインポート（バンドルに含まれる）
import { heavyFunction } from './heavy-module';

// 動的インポート（別チャンクとして分離される）
const button = document.getElementById('btn');
button.addEventListener('click', async () => {
  const { heavyFunction } = await import('./heavy-module');
  heavyFunction();
});
```

**重要: Dynamic Import は Webpack の設定ではなく、アプリケーションコード側の記述。**
Webpack は `import()` 構文を検出すると、追加の設定なしで自動的に別チャンクに分割する。
開発者がコードの中で「ここは後から読み込みたい」と判断した箇所に `import()` を書くだけでよい。

| | 設定する場所 | 誰が判断するか |
|---|---|---|
| **SplitChunksPlugin** | Webpack の設定ファイル | Webpack が自動で分割対象を決める |
| **Dynamic Import** | アプリケーションコード | 開発者が分割すべき箇所を決める |

つまり **「何を分割するか」は開発者が判断し、「どう分割するか」は Webpack が自動処理する** という役割分担になる。

#### 3. SplitChunksPlugin

Webpack 5 に組み込まれている。共通の依存モジュール（例: lodash）を自動的に別チャンクに分離する。

```js
// webpack.common.js
optimization: {
  splitChunks: {
    chunks: 'all',  // すべてのチャンクから共通モジュールを分離
  },
},
```

---

## 10. Tree Shaking

Tree Shaking は、使用されていないコード（デッドコード）をバンドルから除去する最適化。

### 仕組み

ES Modules の `import` / `export` は静的に解析可能なため、どのエクスポートが実際に使われているかをビルド時に判定できる。

```js
// utils.ts
export function usedFunction() {    // ← 使われている → バンドルに含まれる
  return 'hello';
}
export function unusedFunction() {   // ← 使われていない → バンドルから除去される
  return 'world';
}

// index.ts
import { usedFunction } from './utils';  // unusedFunction はインポートしていない
console.log(usedFunction());
```

### Tree Shaking が機能する条件

1. **ES Modules を使用していること**: `import` / `export` 構文が必要。`require()` / `module.exports`（CommonJS）では静的解析ができないため Tree Shaking が効かない
2. **`mode: 'production'`**: development モードでは Tree Shaking は行われない
3. **`tsconfig.json` の `module` が `ESNext`**: `commonjs` だと TypeScript が `require()` に変換してしまい、Tree Shaking が効かなくなる

### このプロジェクトでの設定

```json
// tsconfig.json
{
  "module": "ESNext"  // ES Modules を維持 → Tree Shaking が有効
}
```

---

## 11. 環境変数

### Webpack の mode による自動設定

Webpack は `mode` の値に応じて `process.env.NODE_ENV` を自動的に設定する。

```js
// mode: 'development' → process.env.NODE_ENV === 'development'
// mode: 'production'  → process.env.NODE_ENV === 'production'
```

### 環境変数を定義する方法

#### 方法1: DefinePlugin（Webpack 組み込み）

Webpack に組み込まれている `DefinePlugin` を使い、コード内の変数をビルド時に値に置換する。

```js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_URL': JSON.stringify('https://api.example.com'),
    }),
  ],
};
```

シンプルだが、値を設定ファイルに直接書くため、環境ごとの切り替えが煩雑になる。

#### 方法2: dotenv-webpack（このプロジェクトで採用）

`.env` ファイルから環境変数を読み込み、`process.env.XXX` をビルド時に値に置換するプラグイン。
内部的には `DefinePlugin` を使っている。

```js
// webpack.common.js
const Dotenv = require('dotenv-webpack');

module.exports = {
  plugins: [
    new Dotenv(),
  ],
};
```

### このプロジェクトでの設定

#### .env ファイル

```
# .env（実際の値。.gitignore に含まれるため Git に入らない）
API_URL=https://api.example.com
APP_TITLE=Webpack Playground
```

```
# .env.example（テンプレート。Git に含める。新しい開発者がこれをコピーして .env を作る）
API_URL=https://api.example.com
APP_TITLE=Webpack Playground
```

#### TypeScript の型定義

TypeScript で `process.env` を型安全に使うため、`src/env.d.ts` で型を定義している。

```ts
// src/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    API_URL: string;
    APP_TITLE: string;
  }
}
```

これにより、`process.env.API_URL` にエディタの補完が効き、存在しない環境変数を参照した場合に型エラーになる。

#### コード内での使用

```ts
// src/ts/index.ts
console.log('API_URL:', process.env.API_URL);
console.log('APP_TITLE:', process.env.APP_TITLE);
```

#### ビルド時の動作

`dotenv-webpack` はビルド時に `process.env.API_URL` を `.env` ファイルの値で**文字列置換**する。
バンドルされたコードには `.env` の参照は残らず、値が直接埋め込まれる。

```js
// ビルド前（ソースコード）
console.log('API_URL:', process.env.API_URL);

// ビルド後（バンドル）
console.log('API_URL:', 'https://api.example.com');
```

> **注意**: `.env` ファイルには秘密情報（APIキーなど）を含むことがあるため、必ず `.gitignore` に追加すること。このプロジェクトでは `.gitignore` に `.env` が含まれている。

---

## 12. Alias（パスエイリアス）

ファイルのインポートパスに短い別名（エイリアス）を設定する仕組み。

### なぜ必要か

深いディレクトリ構造では相対パスが複雑になる。

```ts
// エイリアスなし（深くなるほど ../../../ が増える）
import { common } from '../../../common/_common';
import '../../../scss/styles.scss';

// エイリアスあり
import { common } from '@ts/common/_common';
import '@scss/styles.scss';
```

### 設定箇所（2箇所に設定が必要）

#### 1. Webpack（実際のバンドル時のパス解決）

```js
// webpack.common.js
resolve: {
  extensions: ['.ts', '.js'],      // import時に拡張子を省略可能にする
  alias: {
    '@assets': path.resolve(__dirname, './src/assets/'),
    '@scss': path.resolve(__dirname, './src/scss/'),
    '@ts': path.resolve(__dirname, './src/ts/'),
  },
},
```

#### 2. tsconfig.json（エディタの補完・型チェック用）

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@assets/*": ["./src/assets/*"],
      "@scss/*": ["./src/scss/*"],
      "@ts/*": ["./src/ts/*"]
    }
  }
}
```

Webpack の `alias` だけではビルドは通るが、VS Code などのエディタがパスを認識できず、補完やジャンプが効かない。
`tsconfig.json` の `paths` も合わせて設定することで、エディタの開発体験が向上する。

---

## 13. ESLint

ESLint はJavaScript / TypeScript の静的解析ツール。コードの品質を検査し、バグになりやすいパターンを検出する。

### ESLint v9 と Flat Config

ESLint v9 から設定ファイルの形式が **Flat Config** に変わった。

| バージョン | 設定ファイル | 形式 |
|---|---|---|
| v8 以前 | `.eslintrc.js` / `.eslintrc.json` | カスケード方式（`extends` で継承） |
| v9 以降 | `eslint.config.js` | Flat Config（配列で設定を並べる） |

### このプロジェクトの ESLint 設定

```js
// eslint.config.js
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', 'webpack.*.js', 'eslint.config.js'],
  },
  js.configs.recommended,            // ESLint 推奨ルール
  ...tseslint.configs.recommended,    // TypeScript 推奨ルール
  prettierConfig,                     // Prettier と競合するルールを無効化
  {
    languageOptions: {
      parserOptions: {
        projectService: true,          // tsconfig.json を自動検出
        tsconfigRootDir: __dirname,
      },
    },
  },
);
```

#### 設定の解説

| 部分 | 説明 |
|---|---|
| `ignores` | 検査対象外のファイル/ディレクトリ。Flat Config では `.eslintignore` ファイルの代わりにここで指定する |
| `js.configs.recommended` | ESLint 公式の推奨ルール（未使用変数の警告、暗黙の型変換の禁止など） |
| `tseslint.configs.recommended` | TypeScript 用の推奨ルール（any の禁止、未使用のインポートの警告など） |
| `prettierConfig` | Prettier と競合する ESLint ルール（インデント、セミコロンなど）を無効化 |
| `projectService` | `tsconfig.json` を自動検出して型情報を利用したルールを有効にする |

### 実行方法

```bash
pnpm lint        # 検査のみ
pnpm lint:fix    # 自動修正可能なものを修正
```

---

## 14. Prettier

Prettier はコードフォーマッター。コードの見た目（インデント、改行、引用符など）を統一する。

### ESLint との違い

| | ESLint | Prettier |
|---|---|---|
| **目的** | コード品質の検査（バグの検出） | コードスタイルの統一（見た目の整形） |
| **例** | 未使用変数の警告、`==` の代わりに `===` を推奨 | インデント幅、引用符の種類、末尾カンマ |
| **自動修正** | 一部のルールのみ | すべて自動修正 |

### このプロジェクトの設定

```json
// .prettierrc
{
  "singleQuote": true,      // シングルクォートを使用
  "trailingComma": "all",   // 末尾カンマを常につける
  "printWidth": 100          // 1行の最大文字数
}
```

| オプション | 設定値 | 説明 |
|---|---|---|
| `singleQuote` | `true` | `"hello"` → `'hello'` |
| `trailingComma` | `"all"` | 配列やオブジェクトの最後の要素にもカンマをつける。差分（diff）がきれいになる |
| `printWidth` | `100` | 100文字を超える行は折り返す |

### 実行方法

```bash
pnpm format    # src/ 配下の js, ts, scss, html を整形
```

---

## 15. ESLint と Prettier の共存

ESLint にもコードスタイルに関するルール（セミコロン、インデントなど）があり、Prettier と競合する場合がある。

### 問題

```js
// Prettier: セミコロンなし
const x = 1

// ESLint (semi ルール): セミコロン必須
const x = 1;

// → 両方有効だと、片方が修正しても他方が警告を出す無限ループ
```

### 解決策: eslint-config-prettier

`eslint-config-prettier` は、Prettier と競合する ESLint ルールをすべて無効化する。

```js
// eslint.config.js
module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,  // ← 最後に置くことで、上の設定の競合ルールを上書き無効化
);
```

**重要**: `prettierConfig` は配列の**最後**に置く必要がある。Flat Config は配列の順番で後勝ちするため、最後に置くことで確実に競合ルールを無効化できる。

### 推奨される使い分け

```
コード品質 → ESLint が担当（未使用変数、型の不一致など）
コードスタイル → Prettier が担当（インデント、改行、引用符など）
```

---

## 16. Stylelint

Stylelint は CSS / SCSS の静的解析ツール。ESLint が JavaScript / TypeScript を対象とするのに対し、Stylelint は スタイルシートを対象とする。

### ESLint との役割分担

| ツール | 対象 | 例 |
|---|---|---|
| **ESLint** | JavaScript / TypeScript | 未使用変数、型の不一致 |
| **Stylelint** | CSS / SCSS | プロパティの記述順序、無効なセレクタ、カラーコードの統一 |
| **Prettier** | すべてのファイル | インデント、改行、引用符（見た目の統一） |

### このプロジェクトの設定

```json
// .stylelintrc.json
{
  "extends": [
    "stylelint-config-standard-scss",
    "stylelint-config-recess-order"
  ]
}
```

| 設定 | 説明 |
|---|---|
| `stylelint-config-standard-scss` | SCSS 向けの標準ルールセット。`stylelint-config-standard`（CSS標準）に SCSS 固有のルールを追加したもの |
| `stylelint-config-recess-order` | CSS プロパティの記述順序を RECESS 順（position → display → box model → typography → visual の順）に統一する |

#### プロパティ記述順序の例（RECESS 順）

```scss
.element {
  // 1. Position
  position: absolute;
  top: 0;
  left: 0;

  // 2. Display & Box Model
  display: flex;
  width: 100px;
  height: 100px;
  margin: 10px;
  padding: 10px;

  // 3. Typography
  font-size: 16px;
  color: #333;

  // 4. Visual
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
}
```

### 実行方法

```bash
pnpm stylelint        # 検査のみ
pnpm stylelint:fix    # 自動修正可能なものを修正
```

---

## 17. EditorConfig

EditorConfig はエディタ間で基本的なコーディングスタイルを統一する仕組み。
VS Code、JetBrains（WebStorm 等）、Vim など、ほぼすべてのエディタが対応している。

### Prettier との違い

| | EditorConfig | Prettier |
|---|---|---|
| **動作タイミング** | ファイル編集中（リアルタイム） | コマンド実行時 or 保存時 |
| **対象** | すべてのファイル（設定ファイル、Markdown 等も含む） | 対応言語のソースコード |
| **設定範囲** | 文字コード、改行コード、インデント、末尾改行、末尾空白 | コードの整形全般 |
| **役割** | エディタの基本動作を揃える | コードを美しく整形する |

EditorConfig は「エディタがファイルを開いた時点で正しい設定になる」ことを保証する。
Prettier は「コードを保存/実行した時に整形する」ツール。両者は補完関係にある。

### このプロジェクトの設定

```ini
# .editorconfig
root = true

[*]
charset = utf-8                  # 文字コード
end_of_line = lf                 # 改行コード（LF）
indent_style = space             # インデントにスペースを使用
indent_size = 2                  # インデント幅 2
insert_final_newline = true      # ファイル末尾に改行を挿入
trim_trailing_whitespace = true  # 行末の空白を削除

[*.md]
trim_trailing_whitespace = false # Markdown では行末空白に意味がある（改行）
```

`root = true` を設定すると、親ディレクトリの `.editorconfig` を探索しなくなる。プロジェクトルートに置くファイルには必ず指定する。

---

## 18. husky + lint-staged（Git フック）

`git commit` 時に自動で ESLint・Prettier・Stylelint をステージされたファイルに対して実行する仕組み。
リントエラーやフォーマット崩れのあるコードがリポジトリに入るのを防ぐ。

### 仕組み

```
git commit 実行
  → husky が .husky/pre-commit フックを実行
    → lint-staged がステージされたファイルのみを対象にツールを実行
      → .js/.ts → Prettier + ESLint
      → .css/.scss → Prettier + Stylelint
      → .html → Prettier
    → すべてパスすればコミット成功
    → エラーがあればコミット中断
```

### husky とは

Git フック（`pre-commit`, `pre-push` など）を簡単に管理するツール。
Git フックは `.git/hooks/` 内のスクリプトだが、`.git/` は Git 管理対象外のため、チームで共有できない。husky は `.husky/` ディレクトリにフックを定義し、Git で共有可能にする。

### lint-staged とは

**ステージされたファイル（`git add` されたファイル）のみ** を対象にツールを実行する。
プロジェクト全体にリンターを走らせると時間がかかるが、lint-staged は変更されたファイルだけを対象にするため高速。

### このプロジェクトの設定

```sh
# .husky/pre-commit
pnpm exec lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "src/**/*.{js,ts}": [
      "prettier --write",
      "eslint --fix"
    ],
    "src/**/*.{css,scss}": [
      "prettier --write",
      "stylelint --fix"
    ],
    "src/**/*.html": [
      "prettier --write"
    ]
  }
}
```

配列内のコマンドは**上から順番に実行**される。Prettier でフォーマットしてから ESLint / Stylelint で検査する順序が重要。

### セットアップ手順

```bash
# 1. インストール
pnpm add -D husky lint-staged

# 2. husky の初期化（.husky/ ディレクトリと pre-commit フックを作成）
pnpm exec husky init

# 3. pre-commit フックの内容を lint-staged に変更
echo "pnpm exec lint-staged" > .husky/pre-commit
```

`pnpm install` 時に `prepare` スクリプトが自動実行され、husky が Git フックをセットアップする。新しい開発者がリポジトリをクローンして `pnpm install` するだけで、フックが有効になる。

---

## 19. Node.js バージョン管理（Volta）

### なぜバージョン管理が必要か

Node.js のバージョンが開発者間で異なると、以下の問題が起きる:
- パッケージのインストールが失敗する
- ビルド結果が異なる
- 「自分の環境では動くのに」という問題

### Volta とは

Volta は Node.js のバージョン管理ツール。`package.json` にバージョンを記録し、プロジェクトディレクトリに入った瞬間に自動で切り替える。

### このプロジェクトの設定

```json
// package.json
{
  "volta": {
    "node": "22.22.2"
  }
}
```

Volta がインストールされていれば、このプロジェクトのディレクトリに `cd` した時点で自動的に Node.js 22.22.2 が使われる。明示的な `nvm use` 等のコマンドは不要。

### 他のバージョン管理ツールとの比較

| ツール | バージョン指定方法 | 自動切り替え |
|---|---|---|
| **Volta** | `package.json` の `volta` フィールド | プロジェクトディレクトリ進入時に自動 |
| **nvm** | `.nvmrc` ファイル | `nvm use` を手動実行（シェル設定で自動化可能） |
| **nodenv** | `.node-version` ファイル | シェルのフック機能で自動 |
| **asdf** | `.tool-versions` ファイル | シェルのフック機能で自動 |

Volta の特徴は `package.json` に直接書けること。専用ファイルが不要で、パッケージマネージャー（pnpm）のバージョン固定もできる。

---

## 20. Webpack と Vite の違い

### 根本的なアーキテクチャの違い

#### Webpack（バンドルベース）

```
開発時:
  全ファイル → バンドル → メモリ上に展開 → ブラウザに配信

本番ビルド:
  全ファイル → バンドル → 最適化 → dist/ に出力
```

開発サーバー起動時にプロジェクト全体をバンドルするため、プロジェクトが大きくなるほど起動が遅くなる。

#### Vite（ネイティブESMベース）

```
開発時:
  ブラウザがリクエスト → 該当ファイルだけを変換 → ブラウザに配信
  （バンドルしない。ブラウザのES Modules機能を直接利用）

本番ビルド:
  全ファイル → Rollup でバンドル → 最適化 → dist/ に出力
```

開発時はバンドルせず、ブラウザが `import` 文を見てサーバーにリクエストし、サーバーがその都度ファイルを変換して返す。そのため、起動が非常に速い。

### 比較表

| 項目 | Webpack | Vite |
|---|---|---|
| **開発サーバー起動** | 全体をバンドルしてから起動（遅い） | 即座に起動（バンドルしない） |
| **HMR** | 依存グラフを再計算（プロジェクト規模に依存） | 変更ファイルのみ再変換（常に高速） |
| **本番ビルド** | Webpack 自身がバンドル | Rollup がバンドル |
| **設定の複雑さ** | Loader / Plugin を細かく設定 | ほぼゼロコンフィグ（TypeScript, Sass 等は組み込み） |
| **エコシステム** | 巨大（Loaderが豊富） | 成長中（プラグインで拡張） |
| **学習コスト** | 高い（概念が多い） | 低い |

### Vite の開発サーバーが速い理由

1. **バンドルしない**: ブラウザの ES Modules 機能を直接利用。`<script type="module">` でファイルを読み込み、`import` 文をブラウザがそのまま解釈する
2. **オンデマンド変換**: リクエストされたファイルだけをその場で変換する。未アクセスのファイルは変換しない
3. **esbuild によるプリバンドル**: `node_modules` 内のパッケージは Go 製の高速トランスパイラ esbuild で事前変換。JavaScript での変換より10〜100倍速い

### どちらを選ぶべきか

| 状況 | 推奨 |
|---|---|
| 新規プロジェクト | **Vite**（シンプルで高速） |
| 既存の大規模 Webpack プロジェクト | **Webpack のまま**（移行コストが高い） |
| 細かいビルド制御が必要 | **Webpack**（設定の自由度が高い） |
| ビルドツールの仕組みを学びたい | **Webpack**（概念を深く理解できる） |

---


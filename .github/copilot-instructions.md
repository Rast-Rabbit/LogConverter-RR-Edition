# Copilot Instructions for ココフォリア/Tekeyログ整形ツール (画像埋め込み機能付き)

## 概要
このプロジェクトは、ココフォリアやTekeyのHTMLチャットログを、画像やカスタマイズ情報を含めて整形・編集・エクスポートできるWebアプリです。主要な処理は `script.js` に集約されており、UIは `index.html` と `style.css` で構成されています。

## アーキテクチャ・主要構成
- **シングルページWebアプリ**: サーバ不要。`index.html` を直接ブラウザで開いて動作。
- **主要ファイル**:
  - `index.html`: UI定義、各種ボタン・入力・パネルの配置。
  - `script.js`: ログ解析、キャラクター設定、画像処理、プロジェクト保存/読込、エクスポート等のロジック。
  - `style.css`: カスタムCSS（主にTailwind CSSでスタイリング）。
- **外部ライブラリ**:
  - [Tailwind CSS](https://tailwindcss.com/)（CDN）
  - [JSZip](https://stuk.github.io/jszip/)
  - Google Fonts

## 主要なデータフロー
- ログファイル（ココフォリア/tekey HTML）や `.cclogproj` プロジェクトファイルを読み込み、`displayLogData` 配列にパース。
- キャラクター設定やカスタマイズ情報は `characterSettings`/`customizationSettings` オブジェクトで管理。
- 編集内容は `.cclogproj`（ZIP+JSON+画像）として保存・読込可能。
- エクスポート時は、編集済みログ＋画像＋CSSをZIPで出力。

## 開発・デバッグワークフロー
- **ビルド不要**: 直接 `index.html` をブラウザで開く。
- **テスト**: 専用テストコードは無し。主要な動作確認は手動で行う。
- **デバッグ**: ブラウザのDevToolsで `script.js` を直接デバッグ。
- **依存管理**: すべてCDN経由。npm等は未使用。

## プロジェクト固有のパターン・注意点
- **IIFE構造**: `script.js` は即時関数(IIFE)で全体をラップし、グローバル汚染を防止。
- **State管理**: `displayLogData`, `characterSettings`, `customizationSettings` などのグローバル変数で状態を保持。
- **プロジェクトファイル仕様**: `.cclogproj` はZIP形式で、`project_data.json`＋画像フォルダを内包。
- **LocalStorage**: 一時的な設定保存に利用（キー: `logToolSettings_v11.0`）。
- **UI要素のID命名**: `index.html` の各種ボタン・入力はIDで取得し、`script.js` でイベントバインド。
- **日本語UI/コメント**: UI・コメントともに日本語中心。

## 参考ファイル
- `README.md`: 機能・使い方・技術構成の詳細。
- `LICENSE`: MITライセンス。

---

### 例: 主要な状態変数
```js
let displayLogData = []; // 編集中のログ本体
let characterSettings = {}; // 発言者ごとの設定
let customizationSettings = { ... }; // 表示カスタマイズ
```

### 例: プロジェクトファイル仕様
- 拡張子: `.cclogproj`
- ZIP内: `project_data.json`（設定本体）, `images/`（画像）

---

## AIエージェント向けTips
- コード追加時はIIFE内に記述。
- UI拡張時は `index.html` のID命名規則・既存パネル構造を踏襲。
- 外部依存はCDN経由で追加。
- テストやビルド工程は不要。
- 既存の日本語UI/コメントに合わせる。

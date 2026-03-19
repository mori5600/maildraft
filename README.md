# MailDraft

MailDraft は、日本語メールの下書き作成に特化したローカルファーストのデスクトップアプリです。  
下書き、テンプレート、署名、差し込み値セットを分けて管理しながら、プレーンテキストのメール文を素早く組み立てられます。

- 対応想定: macOS / Windows
- スタック: Tauri v2, React 19, TypeScript, Vite, Tailwind CSS v4, Rust
- 現在のアプリバージョン: `1.2.0`

## できること

- 下書き、テンプレート、署名の作成、編集、削除
- テンプレートからの下書き作成
- `{{会社名}}` のような差し込み変数の入力と、差し込み値セットの保存
- 下書きの自動保存と履歴復元
- ゴミ箱への退避、復元、完全削除
- 完成プレビューの表示、拡大表示、プレーンテキストコピー
- 半角スペース、全角スペースの可視化
- ダーク表示 / ライト表示の切り替え
- バックアップの書き出し / 読み込み
- 個人情報を保存しない前提の診断ログ設定

## 画面構成

- `下書き`: 本文の作成、差し込み、プレビュー、履歴復元
- `テンプレート`: 定型文の管理と下書き作成
- `署名`: 署名の管理と既定署名の切り替え
- `ゴミ箱`: 削除した下書き、テンプレート、署名の復元
- `設定`: バックアップ、診断ログ設定
- `ヘルプ`: 基本の使い方とショートカット

## 保存と復旧

MailDraft はローカル保存のみを前提にしています。アプリの状態は OS のアプリデータディレクトリ配下に保存されます。

- 保存ファイル
  - `maildraft-store.json`
  - `maildraft-settings.json`
- バックアップファイル
  - `*.bak`
- 破損時の退避ファイル
  - `*.corrupt-<timestamp>`

保存形式は versioned JSON です。古い形式の保存ファイルは読み込み時に移行されます。  
起動時に保存ファイルの復旧や既定値へのフォールバックが発生した場合は、アプリ上部に通知が表示されます。

バックアップの書き出し / 読み込みは設定画面から行えます。バックアップ形式は現在 `v1` です。

## 開発環境

前提:

- Node.js / npm
- Rust toolchain
- Tauri のビルドに必要な各 OS の依存

セットアップ:

```bash
npm install
```

フロントエンドのみ起動:

```bash
npm run dev
```

Tauri アプリを開発起動:

```bash
npm run tauri dev
```

## よく使うコマンド

```bash
npm run build
npm run lint
npm run test
npm run test:coverage
npm run format
npm run format:check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

## 検証の目安

コード変更時の最低ライン:

```bash
npm run lint
npm run test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Rust 側のテストも含めて確認する場合:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

性能確認用の大きいバックアップと手順は [docs/performance-checklist.md](docs/performance-checklist.md) を参照してください。

## ディレクトリ構成

### フロントエンド

- `src/app`: アプリシェル、トップレベル state、workspace 切り替え
- `src/modules/drafts`: 下書きの model、state、UI
- `src/modules/templates`: テンプレートの model、state、UI
- `src/modules/signatures`: 署名の model、state、UI
- `src/modules/trash`: ゴミ箱の model、state、UI
- `src/modules/settings`: 設定、バックアップ、ログ設定 UI
- `src/modules/help`: ヘルプ表示
- `src/modules/renderer`: プレビューとチェックの派生ロジック
- `src/shared`: 共通 UI、ユーティリティ、型

### バックエンド

- `src-tauri/src/app`: Tauri アプリ state、保存、バックアップ、ログ
- `src-tauri/src/modules`: drafts / templates / signatures / trash / store の Rust 側実装
- `src-tauri/capabilities`: Tauri capability 設定

## 補足

- データは外部サービスへ送信しません。
- 診断ログは本文や宛先を記録しない設計です。
- Windows では、署名されていないインストーラーや実行ファイルに対して初回実行時の警告が表示される場合があります。
- macOS 向けのビルド成果物は現在配布していません。利用する場合はソースコードからビルドが必要です。
- M1 チップ搭載の macOS では動作確認しています。

## 開発メモ

- コメント方針は [docs/comment-style.md](docs/comment-style.md) を参照してください。
- 性能確認手順は [docs/performance-checklist.md](docs/performance-checklist.md) を参照してください。
- リリース手順は [docs/release-checklist.md](docs/release-checklist.md) を参照してください。

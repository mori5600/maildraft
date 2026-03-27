# MailDraft

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/4347a79b-2321-47fd-865b-8eddc0199fe8"
    alt="MailDraft screenshot"
    width="240"
  />
</p>

MailDraft は、日本語メールの下書き作成に特化したローカルファーストのデスクトップアプリです。  
下書き、テンプレート、署名、差し込み値セットを分けて管理しながら、プレーンテキストのメール文を素早く組み立てられます。

- 対応想定: Windows / macOS
- スタック: Tauri v2, React 19, TypeScript, Vite, Tailwind CSS v4, Rust
- 現在のアプリバージョン: `1.4.0`

<img width="1919" height="1027" alt="image" src="https://github.com/user-attachments/assets/b80617a0-d28f-4deb-a931-84f37894479b" />
<img width="1919" height="1029" alt="image" src="https://github.com/user-attachments/assets/3c4509e0-2718-496b-ba82-1dbfea92db31" />

## インストール

### Windows

- ダウンロード先: [GitHub Releases](https://github.com/mori5600/maildraft/releases)
- GitHub Releases から `MailDraft_<version>_x64-setup.exe` をダウンロードして実行します。
- 画面の案内に従ってインストールします。
- 初回実行時は、未署名アプリとして Windows の警告が表示される場合があります。

### macOS

- 現在、macOS 向けの配布物は公開していません。
- 利用する場合は、このリポジトリを取得してローカルでビルドする必要があります。
- 最低限の手順は以下です。

```bash
npm install
npm run tauri build
```

## できること

- 下書き、テンプレート、署名、メモの作成、編集、削除
- 下書き、テンプレート、メモへのタグ付け、既存タグ候補からの再利用、タグ検索、単一タグ絞り込み
- テンプレートやメモからの下書き作成
- `{{会社名}}` のような差し込み変数の入力と、差し込み値セットの保存
- 下書きの自動保存と履歴復元
- 下書きの校正、修正候補の適用、ルールの一時無視 / 無効化
- ゴミ箱への退避、復元、完全削除
- 完成プレビューの表示、拡大表示、プレーンテキストコピー
- 複数行エディタのインデント設定
- 半角スペース、全角スペースの可視化
- ダーク表示 / ライト表示の切り替え
- バックアップの書き出し / 読み込み
- 個人情報を保存しない前提の診断ログ設定

## 画面構成

- `下書き`: 本文の作成、差し込み、プレビュー、履歴復元
- `テンプレート`: 定型文の管理と下書き作成
- `署名`: 署名の管理と既定署名の切り替え
- `メモ`: 会話ログや論点整理、下書き作成前のメモ
- `ゴミ箱`: 削除した下書き、テンプレート、署名の復元
- `設定`: バックアップ、エディタ、校正、診断ログ設定
- `ヘルプ`: 基本の使い方とショートカット

## 保存と復旧

MailDraft はローカル保存のみを前提にしています。アプリの状態は OS のアプリデータディレクトリ配下に保存されます。

- 実行時の保存ファイル
  - `maildraft.sqlite3`
- 旧バージョンからの移行対象ファイル
  - `maildraft-store.json`
  - `maildraft-settings.json`
- バックアップの書き出しファイル
  - `maildraft-backup-YYYYMMDD-HHMM.json`

`1.4.0` 以降の実行時データは SQLite に保存されます。旧バージョンの JSON 保存ファイルが残っている場合は、初回起動時に SQLite へ自動移行します。  
移行や保存データの復旧、既定値へのフォールバックが発生した場合は、アプリ上部に通知が表示されます。

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
- `src/modules/memo`: メモの model、state、UI
- `src/modules/trash`: ゴミ箱の model、state、UI
- `src/modules/settings`: 設定、バックアップ、ログ設定 UI
- `src/modules/help`: ヘルプ表示
- `src/modules/renderer`: プレビューとチェックの派生ロジック
- `src/shared`: 共通 UI、ユーティリティ、型

### バックエンド

- `src-tauri/src/app`: Tauri アプリ state、保存、バックアップ、ログ
- `src-tauri/src/modules`: drafts / templates / signatures / memo / trash / store / variable presets の Rust 側実装
- `src-tauri/capabilities`: Tauri capability 設定

## 補足

- データは外部サービスへ送信しません。
- 診断ログは本文や宛先を記録しない設計です。
- Windows では、署名されていないインストーラーや実行ファイルに対して初回実行時の警告が表示される場合があります。
- macOS 向けのビルド成果物は現在配布していません。利用する場合はソースコードからビルドが必要です。
- M1 チップ搭載の macOS では動作確認しています。

## ライセンス

- MailDraft 本体は MIT License です。
- 利用している OSS のライセンス一覧と notices は [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) にまとめています。

## 開発メモ

- コメント方針は [docs/comment-style.md](docs/comment-style.md) を参照してください。
- 性能確認手順は [docs/performance-checklist.md](docs/performance-checklist.md) を参照してください。
- リリース手順は [docs/release-checklist.md](docs/release-checklist.md) を参照してください。

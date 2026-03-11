# MailDraft

MailDraft は、メールの下書き作成に特化したローカルデスクトップアプリです。  
下書き、テンプレート、署名を分けて管理しながら、プレーンテキストのメール文を整えていくことができます。

## 主な機能

- 下書き、テンプレート、署名の作成と保存
- テンプレートから下書きを作成
- 署名の切り替え
- 完成プレビューの表示と拡大表示
- プレーンテキストでのコピー
- 半角スペース、全角スペースの可視化
- ダークモード、ライトモードの切り替え
- 個人情報を記録しない前提の診断ログ設定

## 技術スタック

- Tauri v2
- React 19
- TypeScript
- Vite
- Rust

## 開発環境の起動

```bash
npm install
npm run tauri dev
```

## よく使うコマンド

```bash
npm run build
npm run lint
npm run format
cargo check --manifest-path src-tauri/Cargo.toml
```

## 本番ビルド

```bash
npm run tauri build
```

## メモ

- データはローカルに保存されます。
- 診断ログは本文や宛先を保存しないように設計しています。

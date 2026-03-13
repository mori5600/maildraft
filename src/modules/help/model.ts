import type { WorkspaceView } from "../../shared/types/store";

export type HelpSection = "usage" | "shortcuts";

export const HELP_SECTIONS: Array<{
  id: HelpSection;
  label: string;
  description: string;
}> = [
  {
    id: "usage",
    label: "使い方",
    description: "基本の流れと運用",
  },
  {
    id: "shortcuts",
    label: "ショートカット",
    description: "使えるキー操作",
  },
];

export interface HelpGuideGroup {
  id: string;
  title: string;
  description: string;
  steps: Array<{
    title: string;
    body: string;
  }>;
}

export const HELP_USAGE_GROUPS: HelpGuideGroup[] = [
  {
    id: "draft-flow",
    title: "基本の流れ",
    description: "1 通の下書きを作って仕上げる手順",
    steps: [
      {
        title: "下書きを作る",
        body: "下書き画面で `New` を押して、Label と Subject を決めます。Label は一覧で見分けるための短い名前です。",
      },
      {
        title: "本文を組み立てる",
        body: "Recipient note、Opening、Body、Closing を分けて入力します。宛名メモと本文を分けておくと、文面の整理がしやすくなります。",
      },
      {
        title: "署名とテンプレートを選ぶ",
        body: "必要なら Template と Signature を選びます。テンプレートを使うと定型文をすぐ下書きへ反映できます。",
      },
      {
        title: "差し込み値を保存する",
        body: "Variables に保存済みセットを作っておくと、会社名や担当者名などの差し込み値を次回以降まとめて再利用できます。",
      },
      {
        title: "プレビューで確認してコピーする",
        body: "右側の Preview で完成形を確認して、問題なければ `Copy` でプレーンテキストの本文をコピーします。",
      },
    ],
  },
  {
    id: "templates-and-signatures",
    title: "テンプレートと署名",
    description: "繰り返し使う文面を育てる",
    steps: [
      {
        title: "テンプレートを作る",
        body: "テンプレート画面で、よく使う件名や本文を保存します。`{{相手名}}` のような差し込み変数もそのまま保存できます。",
      },
      {
        title: "署名を分けて持つ",
        body: "署名画面で仕事用や案件用の署名を分けて保存できます。既定の署名は新規下書きに自動で入ります。",
      },
      {
        title: "テンプレートから起こす",
        body: "テンプレート画面の `Start draft` で、そのテンプレートを元に新しい下書きを始められます。",
      },
    ],
  },
  {
    id: "safety-and-storage",
    title: "復元とバックアップ",
    description: "ローカル保存を前提に安全に運用する",
    steps: [
      {
        title: "自動保存と履歴を使う",
        body: "下書きは自動保存され、履歴から復元できます。書き直したあとでも、前の状態へ戻しやすくなっています。",
      },
      {
        title: "削除はゴミ箱へ送る",
        body: "下書き、テンプレート、署名を削除すると、すぐ消えずにゴミ箱へ移動します。必要なら後から Restore できます。",
      },
      {
        title: "必要に応じてバックアップする",
        body: "設定のバックアップ画面から JSON を Export / Import できます。下書き、テンプレート、署名、差し込み値セットごと別 PC へ移行できます。",
      },
    ],
  },
];

export interface ShortcutGroup {
  id: string;
  title: string;
  description: string;
  items: Array<{
    keys: string;
    description: string;
    note?: string;
  }>;
}

export const KEYBOARD_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "navigation",
    title: "Workspace",
    description: "画面の切り替え",
    items: [
      { keys: "Ctrl/Cmd+1", description: "下書きへ移動" },
      { keys: "Ctrl/Cmd+2", description: "テンプレートへ移動" },
      { keys: "Ctrl/Cmd+3", description: "署名へ移動" },
      { keys: "Ctrl/Cmd+4", description: "ゴミ箱へ移動" },
      { keys: "Ctrl/Cmd+5", description: "設定へ移動" },
      { keys: "Ctrl/Cmd+6", description: "ヘルプへ移動" },
    ],
  },
  {
    id: "editing",
    title: "Editing",
    description: "作成と保存",
    items: [
      {
        keys: "Ctrl/Cmd+N",
        description: "現在の画面に応じて新規作成",
        note: "ヘルプ・設定・ゴミ箱では新規下書き",
      },
      { keys: "Ctrl/Cmd+S", description: "現在の編集内容を保存" },
      {
        keys: "Ctrl/Cmd+Shift+P",
        description: "ピン留めを切り替え",
        note: "下書き・テンプレート・署名のみ",
      },
      {
        keys: "Ctrl/Cmd+Shift+C",
        description: "下書きプレビューをコピー",
        note: "下書きのみ",
      },
    ],
  },
  {
    id: "search",
    title: "Search",
    description: "一覧の操作",
    items: [
      {
        keys: "Ctrl/Cmd+K",
        description: "現在の一覧の検索欄へ移動",
        note: "下書き・テンプレート・署名のみ",
      },
    ],
  },
];

export function getViewShortcutHint(view: WorkspaceView): string {
  switch (view) {
    case "drafts":
      return "Ctrl/Cmd+1";
    case "templates":
      return "Ctrl/Cmd+2";
    case "signatures":
      return "Ctrl/Cmd+3";
    case "trash":
      return "Ctrl/Cmd+4";
    case "settings":
      return "Ctrl/Cmd+5";
    case "help":
      return "Ctrl/Cmd+6";
  }
}

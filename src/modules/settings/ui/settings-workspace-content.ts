import { RECENT_LOG_LIMIT } from "../model";

export type SettingsSection = "logging" | "proofreading" | "backup";

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  {
    id: "logging",
    label: "ログ",
    description: "記録方法と診断ログ",
  },
  {
    id: "proofreading",
    label: "校正",
    description: "無効化したルールの管理",
  },
  {
    id: "backup",
    label: "バックアップ",
    description: "書き出しと復元",
  },
];

export const RECENT_LOGS_DESCRIPTION = `本文を含まない最新 ${RECENT_LOG_LIMIT} 件までの診断ログを確認できます。`;

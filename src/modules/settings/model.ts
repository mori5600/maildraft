export type LoggingMode = "off" | "errors_only" | "standard";

export interface LoggingSettingsInput {
  mode: LoggingMode;
  retentionDays: 7 | 14 | 30;
}

export interface LoggingSettingsSnapshot extends LoggingSettingsInput {
  directoryPath: string;
  totalBytes: number;
  fileCount: number;
  maxFileSizeBytes: number;
  maxRotatedFiles: number;
}

export interface LogEntrySnapshot {
  timestampMs: number;
  level: string;
  eventName: string;
  module: string;
  result: string;
  sessionId: string;
  durationMs: number | null;
  errorCode: string | null;
  safeContext: Record<string, unknown>;
}

export const RECENT_LOG_LIMIT = 80;

export const LOGGING_MODE_OPTIONS: Array<{
  value: LoggingMode;
  label: string;
  description: string;
}> = [
  {
    value: "off",
    label: "オフ",
    description: "ログを書き込みません。",
  },
  {
    value: "errors_only",
    label: "エラーのみ",
    description: "失敗した処理だけを安全な形式で記録します。",
  },
  {
    value: "standard",
    label: "標準",
    description: "保存や削除などの操作結果を本文なしで記録します。",
  },
];

export const RETENTION_DAY_OPTIONS = [7, 14, 30] as const;

export function createDefaultLoggingSettingsSnapshot(): LoggingSettingsSnapshot {
  return {
    mode: "errors_only",
    retentionDays: 14,
    directoryPath: "",
    totalBytes: 0,
    fileCount: 0,
    maxFileSizeBytes: 1024 * 1024,
    maxRotatedFiles: 5,
  };
}

export function toLoggingSettingsInput(snapshot: LoggingSettingsSnapshot): LoggingSettingsInput {
  return {
    mode: snapshot.mode,
    retentionDays: snapshot.retentionDays,
  };
}

export function loggingModeDescription(mode: LoggingMode): string {
  return (
    LOGGING_MODE_OPTIONS.find((option) => option.value === mode)?.description ??
    "ログ設定を選択してください。"
  );
}

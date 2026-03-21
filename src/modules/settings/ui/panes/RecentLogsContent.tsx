import { Pill } from "../../../../shared/ui/primitives";
import type { LogEntrySnapshot } from "../../model";

interface RecentLogsContentProps {
  recentLogs: LogEntrySnapshot[];
  isLoadingRecentLogs: boolean;
}

export function RecentLogsContent({ recentLogs, isLoadingRecentLogs }: RecentLogsContentProps) {
  return (
    <div className="grid gap-2.5">
      {recentLogs.length === 0 ? (
        <div className="rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) px-3.5 py-3 text-[13px] leading-6 text-(--color-text-muted)">
          {isLoadingRecentLogs
            ? "安全なログを読み込んでいます。"
            : "まだ表示できる診断ログはありません。"}
        </div>
      ) : (
        recentLogs.map((entry) => <LogEntryCard key={buildLogKey(entry)} entry={entry} />)
      )}
    </div>
  );
}

function LogEntryCard({ entry }: { entry: LogEntrySnapshot }) {
  const contextEntries = Object.entries(entry.safeContext).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return (
    <article className="rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-(--color-text-strong)">
            {entry.eventName}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-(--color-text-subtle)">
            <span>{formatLogTimestamp(entry.timestampMs)}</span>
            <span>{entry.module}</span>
            <span>{entry.result}</span>
            {entry.durationMs !== null ? <span>{entry.durationMs} ms</span> : null}
            {entry.errorCode ? <span>{entry.errorCode}</span> : null}
          </div>
        </div>
        <Pill tone={entry.level === "error" || entry.result !== "success" ? "accent" : "neutral"}>
          {entry.level}
        </Pill>
      </div>

      {contextEntries.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {contextEntries.map(([key, value]) => (
            <span
              key={key}
              className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-2.5 py-1 text-[11px] text-(--color-text-muted)"
            >
              {key}: {formatLogValue(value)}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2.5 text-[11px] text-(--color-text-subtle)">
          追加の要約情報はありません。
        </div>
      )}
    </article>
  );
}

function formatLogTimestamp(timestampMs: number): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "時刻不明";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestampMs);
}

function formatLogValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value == null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatLogValue(item)).join(", ");
  }

  return JSON.stringify(value);
}

function buildLogKey(entry: LogEntrySnapshot): string {
  return `${entry.timestampMs}:${entry.eventName}:${entry.module}:${entry.result}`;
}

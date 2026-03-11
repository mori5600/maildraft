import { type ReactNode,useState } from "react";

import { formatBytes } from "../../../shared/lib/bytes";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button, Field, Panel, Pill, Select } from "../../../shared/ui/primitives";
import {
  type LogEntrySnapshot,
  LOGGING_MODE_OPTIONS,
  loggingModeDescription,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  RECENT_LOG_LIMIT,
  RETENTION_DAY_OPTIONS,
} from "../model";

interface SettingsWorkspaceProps {
  loggingSettings: LoggingSettingsSnapshot;
  loggingForm: LoggingSettingsInput;
  recentLogs: LogEntrySnapshot[];
  isLoadingRecentLogs: boolean;
  onChangeLogging: <K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) => void;
  onSaveLoggingSettings: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onRefreshRecentLogs: (options?: { silent?: boolean }) => Promise<void>;
}

export function SettingsWorkspace({
  loggingSettings,
  loggingForm,
  recentLogs,
  isLoadingRecentLogs,
  onChangeLogging,
  onSaveLoggingSettings,
  onClearLogs,
  onRefreshRecentLogs,
}: SettingsWorkspaceProps) {
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const isDirty =
    loggingForm.mode !== loggingSettings.mode ||
    loggingForm.retentionDays !== loggingSettings.retentionDays;

  function openLogViewer() {
    setIsLogViewerOpen(true);
    void onRefreshRecentLogs({ silent: true });
  }

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <Button
                disabled={!isDirty}
                size="sm"
                variant="primary"
                onClick={() => void onSaveLoggingSettings()}
              >
                Save
              </Button>
            }
            description="本文や宛先を含まない診断ログだけを扱います。"
            title="Logging"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
            <div className="grid gap-3">
              <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                  Privacy policy
                </div>
                <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
                  <p>件名、本文、宛先、署名本文、クリップボードの内容はログへ保存しません。</p>
                  <p>
                    記録するのは、処理の成功・失敗、所要時間、件数や文字数のような要約情報だけです。
                  </p>
                </div>
              </section>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Log mode" hint={loggingModeDescription(loggingForm.mode)}>
                  <Select
                    value={loggingForm.mode}
                    onChange={(event) =>
                      onChangeLogging(
                        "mode",
                        event.currentTarget.value as LoggingSettingsInput["mode"],
                      )
                    }
                  >
                    {LOGGING_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Retention">
                  <Select
                    value={String(loggingForm.retentionDays)}
                    onChange={(event) =>
                      onChangeLogging(
                        "retentionDays",
                        Number(event.currentTarget.value) as LoggingSettingsInput["retentionDays"],
                      )
                    }
                  >
                    {RETENTION_DAY_OPTIONS.map((days) => (
                      <option key={days} value={days}>
                        {days}日
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                  Current behavior
                </div>
                <div className="mt-2.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
                  {loggingModeDescription(loggingSettings.mode)} 保持期間は{" "}
                  {loggingSettings.retentionDays}
                  日です。
                </div>
              </section>
            </div>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={openLogViewer}>
                  View logs
                </Button>
                <Button
                  disabled={loggingSettings.fileCount === 0}
                  size="sm"
                  variant="danger"
                  onClick={() => void onClearLogs()}
                >
                  Clear logs
                </Button>
              </div>
            }
            description="ローカルに保存された診断情報"
            title="Storage"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
            <div className="grid gap-3">
              <StatCard
                label="Usage"
                value={formatBytes(loggingSettings.totalBytes)}
                note={`1ファイル ${formatBytes(loggingSettings.maxFileSizeBytes)} / current + ${loggingSettings.maxRotatedFiles}世代`}
              />
              <StatCard
                label="Files"
                value={`${loggingSettings.fileCount} files`}
                note="JSONL 形式で保存"
              />
              <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3.5 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                  Log directory
                </div>
                <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap break-all text-[13px] leading-6 text-[var(--color-text-strong)]">
                  {loggingSettings.directoryPath || "初回書き込み時に作成されます。"}
                </pre>
              </section>
            </div>
          </div>
        </Panel>
      </div>

      <PreviewOverlay
        action={
          <Button
            disabled={isLoadingRecentLogs}
            size="sm"
            variant="secondary"
            onClick={() => void onRefreshRecentLogs()}
          >
            {isLoadingRecentLogs ? "Refreshing" : "Refresh"}
          </Button>
        }
        description={`本文を含まない最新 ${RECENT_LOG_LIMIT} 件までの診断ログを確認できます。`}
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
        title="Recent logs"
      >
        <div className="grid gap-2.5">
          {recentLogs.length === 0 ? (
            <div className="rounded-[8px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg)] px-3.5 py-3 text-[13px] leading-6 text-[var(--color-text-muted)]">
              {isLoadingRecentLogs
                ? "安全なログを読み込んでいます。"
                : "まだ表示できる診断ログはありません。"}
            </div>
          ) : (
            recentLogs.map((entry) => <LogEntryCard key={buildLogKey(entry)} entry={entry} />)
          )}
        </div>
      </PreviewOverlay>
    </>
  );
}

function PaneHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-panel-border-strong)] px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--color-text-strong)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--color-text-subtle)]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="mt-2.5 text-[17px] font-medium text-[var(--color-text-strong)]">{value}</div>
      <div className="mt-1.5 text-[13px] leading-6 text-[var(--color-text-muted)]">{note}</div>
    </section>
  );
}

function LogEntryCard({ entry }: { entry: LogEntrySnapshot }) {
  const contextEntries = Object.entries(entry.safeContext).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return (
    <article className="rounded-[8px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg)] px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[var(--color-text-strong)]">
            {entry.eventName}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-subtle)]">
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
              className="rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)]"
            >
              {key}: {formatLogValue(value)}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2.5 text-[11px] text-[var(--color-text-subtle)]">
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

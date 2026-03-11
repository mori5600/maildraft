import type { ReactNode } from "react";

import { formatBytes } from "../../../shared/lib/bytes";
import { Button, Field, Panel, Select } from "../../../shared/ui/primitives";
import {
  LOGGING_MODE_OPTIONS,
  loggingModeDescription,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  RETENTION_DAY_OPTIONS,
} from "../model";

interface SettingsWorkspaceProps {
  loggingSettings: LoggingSettingsSnapshot;
  loggingForm: LoggingSettingsInput;
  onChangeLogging: <K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) => void;
  onSaveLoggingSettings: () => Promise<void>;
  onClearLogs: () => Promise<void>;
}

export function SettingsWorkspace({
  loggingSettings,
  loggingForm,
  onChangeLogging,
  onSaveLoggingSettings,
  onClearLogs,
}: SettingsWorkspaceProps) {
  const isDirty =
    loggingForm.mode !== loggingSettings.mode ||
    loggingForm.retentionDays !== loggingSettings.retentionDays;

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5">
            <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                Privacy policy
              </div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--color-text-muted)]">
                <p>件名、本文、宛先、署名本文、クリップボードの内容はログへ保存しません。</p>
                <p>
                  記録するのは、処理の成功・失敗、所要時間、件数や文字数のような要約情報だけです。
                </p>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
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

            <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                Current behavior
              </div>
              <div className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
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
            <Button
              disabled={loggingSettings.fileCount === 0}
              size="sm"
              variant="danger"
              onClick={() => void onClearLogs()}
            >
              Clear logs
            </Button>
          }
          description="ローカルに保存された診断情報"
          title="Storage"
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
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
            <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                Log directory
              </div>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-sm leading-6 text-[var(--color-text-strong)]">
                {loggingSettings.directoryPath || "初回書き込み時に作成されます。"}
              </pre>
            </section>
          </div>
        </div>
      </Panel>
    </div>
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
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--color-panel-border-strong)] px-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-text-strong)]">{title}</div>
        <div className="truncate text-xs text-[var(--color-text-subtle)]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="mt-3 text-lg font-medium text-[var(--color-text-strong)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{note}</div>
    </section>
  );
}

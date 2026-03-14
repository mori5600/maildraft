import { formatBytes } from "../../../../shared/lib/bytes";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel } from "../../../../shared/ui/primitives";
import type { LoggingSettingsSnapshot } from "../../model";

interface LoggingOverviewPaneProps {
  loggingSettings: LoggingSettingsSnapshot;
  onOpenLogViewer: () => void;
  onClearLogs: () => Promise<void>;
}

export function LoggingOverviewPane({
  loggingSettings,
  onOpenLogViewer,
  onClearLogs,
}: LoggingOverviewPaneProps) {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onOpenLogViewer}>
              ログを見る
            </Button>
            <Button
              disabled={loggingSettings.fileCount === 0}
              size="sm"
              variant="danger"
              onClick={() => void onClearLogs()}
            >
              ログを削除
            </Button>
          </div>
        }
        description="保存済みの診断ログを確認します。"
        title="診断ログ"
      />

      <div className="px-3.5 py-3.5">
        <div className="grid gap-3 md:grid-cols-2">
          <LoggingStatCard
            label="使用量"
            note={`1ファイル ${formatBytes(loggingSettings.maxFileSizeBytes)} / 現在 + ${loggingSettings.maxRotatedFiles}世代`}
            value={formatBytes(loggingSettings.totalBytes)}
          />
          <LoggingStatCard
            label="ファイル数"
            note="JSONL 形式で保存"
            value={`${loggingSettings.fileCount}ファイル`}
          />
        </div>
        <section className="mt-3 rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            保存先
          </div>
          <pre className="mt-2.5 overflow-x-auto text-[13px] leading-6 break-all whitespace-pre-wrap text-(--color-text-strong)">
            {loggingSettings.directoryPath || "初回書き込み時に作成されます。"}
          </pre>
        </section>
      </div>
    </Panel>
  );
}

function LoggingStatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
      <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
        {label}
      </div>
      <div className="mt-2.5 text-[17px] font-medium text-(--color-text-strong)">{value}</div>
      <div className="mt-1.5 text-[13px] leading-6 text-(--color-text-muted)">{note}</div>
    </section>
  );
}

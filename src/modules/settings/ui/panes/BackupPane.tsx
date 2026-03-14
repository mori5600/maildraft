import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel } from "../../../../shared/ui/primitives";

interface BackupPaneProps {
  isExportingBackup: boolean;
  isImportingBackup: boolean;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
}

export function BackupPane({
  isExportingBackup,
  isImportingBackup,
  onExportBackup,
  onImportBackup,
}: BackupPaneProps) {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader description="下書きデータの書き出しと復元" title="バックアップ" />

      <div className="px-3.5 py-3.5">
        <div className="grid gap-3">
          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              含まれる内容
            </div>
            <div className="mt-2.5 text-[13px] leading-6 text-(--color-text-muted)">
              下書き、テンプレート、署名、差し込み値セット、履歴、ログ設定を JSON
              として保存します。診断ログ本体は含めません。
            </div>
          </section>

          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              操作
            </div>
            <div className="mt-2.5 text-[13px] leading-6 text-(--color-text-muted)">
              読み込みは現在のローカルデータを置き換えます。必要なら先に書き出しを実行してください。
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={isExportingBackup || isImportingBackup}
                size="sm"
                variant="secondary"
                onClick={() => void onExportBackup()}
              >
                {isExportingBackup ? "書き出し中" : "書き出し"}
              </Button>
              <Button
                disabled={isExportingBackup || isImportingBackup}
                size="sm"
                variant="secondary"
                onClick={() => void onImportBackup()}
              >
                {isImportingBackup ? "読み込み中" : "読み込み"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Panel>
  );
}

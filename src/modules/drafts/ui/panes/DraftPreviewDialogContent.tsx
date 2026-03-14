import { DraftCheckList } from "./DraftCheckList";

interface DraftPreviewDialogContentProps {
  previewSubject: string;
  previewBodyText: string;
  checks: string[];
}

export function DraftPreviewDialogContent({
  previewSubject,
  previewBodyText,
  checks,
}: DraftPreviewDialogContentProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) p-4">
        <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
          本文
        </div>
        <pre className="mail-preview-text mt-2.5 min-h-120 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
          {previewBodyText}
        </pre>
      </section>

      <div className="space-y-3">
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) p-4">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            件名
          </div>
          <div className="mt-2.5 text-[13px] text-(--color-text-strong)">
            {previewSubject || "件名未設定"}
          </div>
        </section>

        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) p-4">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            確認
          </div>
          <DraftCheckList checks={checks} />
        </section>
      </div>
    </div>
  );
}

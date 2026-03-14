interface TemplatePreviewDialogContentProps {
  subject: string;
  previewBodyText: string;
}

export function TemplatePreviewDialogContent({
  subject,
  previewBodyText,
}: TemplatePreviewDialogContentProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
      <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) p-4">
        <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
          件名
        </div>
        <div className="mt-2.5 text-[13px] text-(--color-text-strong)">
          {subject || "件名未設定"}
        </div>
      </section>

      <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) p-4">
        <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
          本文
        </div>
        <pre className="mail-preview-text mt-2.5 min-h-120 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
          {previewBodyText}
        </pre>
      </section>
    </div>
  );
}

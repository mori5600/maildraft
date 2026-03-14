import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel } from "../../../../shared/ui/primitives";
import type { TemplateInput } from "../../model";

interface TemplatePreviewPaneProps {
  templateForm: TemplateInput;
  previewBodyText: string;
  canExpandPreview: boolean;
  onOpenPreview: () => void;
  onStartDraftFromTemplate: () => void;
}

export function TemplatePreviewPane({
  templateForm,
  previewBodyText,
  canExpandPreview,
  onOpenPreview,
  onStartDraftFromTemplate,
}: TemplatePreviewPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button
              disabled={!canExpandPreview}
              size="sm"
              variant="ghost"
              onClick={onOpenPreview}
            >
              拡大
            </Button>
            <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
              下書きを作成
            </Button>
          </div>
        }
        description="仕上がり表示"
        title="プレビュー"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            件名
          </div>
          <div className="mt-1.5 text-[13px] text-(--color-text-strong)">
            {templateForm.subject || "件名未設定"}
          </div>
        </div>
        <div className="px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            本文
          </div>
          <pre className="mail-preview-text mt-2 overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-3.5 py-3 whitespace-pre-wrap text-(--color-preview-text)">
            {previewBodyText}
          </pre>
        </div>
      </div>
    </Panel>
  );
}

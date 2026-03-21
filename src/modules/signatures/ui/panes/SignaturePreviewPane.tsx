import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel } from "../../../../shared/ui/primitives";

interface SignaturePreviewPaneProps {
  previewBodyText: string;
  canExpandPreview: boolean;
  onOpenPreview: () => void;
}

export function SignaturePreviewPane({
  previewBodyText,
  canExpandPreview,
  onOpenPreview,
}: SignaturePreviewPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button disabled={!canExpandPreview} size="sm" variant="ghost" onClick={onOpenPreview}>
            拡大
          </Button>
        }
        description="仕上がり表示"
        title="プレビュー"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        <pre className="mail-signature-text overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-3.5 py-3 whitespace-pre-wrap text-(--color-preview-text)">
          {previewBodyText}
        </pre>
      </div>
    </Panel>
  );
}

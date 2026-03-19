import { CodeEditor } from "../../../../shared/ui/code-editor/CodeEditor";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Input, Panel } from "../../../../shared/ui/primitives";
import type { SignatureInput } from "../../model";

interface SignatureEditorPaneProps {
  signatureForm: SignatureInput;
  selectedSignatureId: string | null;
  showWhitespace: boolean;
  canDuplicate: boolean;
  onChangeSignature: <K extends keyof SignatureInput>(
    field: K,
    value: SignatureInput[K],
  ) => void;
  onSaveSignature: () => Promise<void>;
  onDeleteSignature: () => Promise<void>;
  onDuplicateSignature: () => Promise<void>;
  onTogglePinned: () => void;
}

export function SignatureEditorPane({
  signatureForm,
  selectedSignatureId,
  showWhitespace,
  canDuplicate,
  onChangeSignature,
  onSaveSignature,
  onDeleteSignature,
  onDuplicateSignature,
  onTogglePinned,
}: SignatureEditorPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button size="sm" title="Ctrl/Cmd+Shift+P" variant="ghost" onClick={onTogglePinned}>
              {signatureForm.isPinned ? "固定解除" : "固定"}
            </Button>
            <Button
              disabled={!canDuplicate}
              size="sm"
              variant="ghost"
              onClick={() => void onDuplicateSignature()}
            >
              複製
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onDeleteSignature()}>
              {selectedSignatureId ? "ゴミ箱へ移動" : "リセット"}
            </Button>
            <Button
              size="sm"
              title="Ctrl/Cmd+S"
              variant="primary"
              onClick={() => void onSaveSignature()}
            >
              保存
            </Button>
          </div>
        }
        description={`${signatureForm.isPinned ? "固定・" : ""}${signatureForm.name}`}
        title="署名編集"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <div className="grid gap-3">
          <Field label="名前">
            <Input
              showWhitespace={showWhitespace}
              value={signatureForm.name}
              onChange={(event) => onChangeSignature("name", event.currentTarget.value)}
            />
          </Field>

          <label className="flex items-center gap-2.5 rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] text-(--color-checkbox-text)">
            <input
              checked={signatureForm.isDefault}
              className="h-4 w-4 rounded border-(--color-checkbox-border) bg-(--color-checkbox-bg) text-(--color-button-primary-border) accent-(--color-button-primary-border)"
              type="checkbox"
              onChange={(event) => onChangeSignature("isDefault", event.currentTarget.checked)}
            />
            新規下書きで既定の署名として使う
          </label>

          <Field label="本文" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="本文"
              className="min-h-80"
              contentClassName="mail-signature-edit-text"
              showWhitespace={showWhitespace}
              value={signatureForm.body}
              onChange={(value) => onChangeSignature("body", value)}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

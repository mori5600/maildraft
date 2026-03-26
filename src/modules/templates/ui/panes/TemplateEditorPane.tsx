import { CodeEditor } from "../../../../shared/ui/code-editor/CodeEditor";
import type { EditorSettings } from "../../../../shared/ui/code-editor/editor-settings";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Panel, Select } from "../../../../shared/ui/primitives";
import type { Signature } from "../../../signatures/model";
import type { TemplateInput } from "../../model";

interface TemplateEditorPaneProps {
  signatures: Signature[];
  selectedTemplateId: string | null;
  templateForm: TemplateInput;
  editorSettings?: EditorSettings;
  showWhitespace: boolean;
  autoSaveLabel: string;
  canDuplicate: boolean;
  onChangeTemplate: <K extends keyof TemplateInput>(field: K, value: TemplateInput[K]) => void;
  onSaveTemplate: () => Promise<void>;
  onDeleteTemplate: () => Promise<void>;
  onDuplicateTemplate: () => Promise<void>;
  onTogglePinned: () => void;
}

export function TemplateEditorPane({
  signatures,
  selectedTemplateId,
  templateForm,
  editorSettings,
  showWhitespace,
  autoSaveLabel,
  canDuplicate,
  onChangeTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onTogglePinned,
}: TemplateEditorPaneProps) {
  const hasMissingSignature = Boolean(
    templateForm.signatureId &&
    !signatures.some((signature) => signature.id === templateForm.signatureId),
  );

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button size="sm" title="Ctrl/Cmd+Shift+P" variant="ghost" onClick={onTogglePinned}>
              {templateForm.isPinned ? "固定解除" : "固定"}
            </Button>
            <Button
              disabled={!canDuplicate}
              size="sm"
              variant="ghost"
              onClick={() => void onDuplicateTemplate()}
            >
              複製
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onDeleteTemplate()}>
              {selectedTemplateId ? "ゴミ箱へ移動" : "リセット"}
            </Button>
            <Button
              size="sm"
              title="Ctrl/Cmd+S"
              variant="primary"
              onClick={() => void onSaveTemplate()}
            >
              保存
            </Button>
          </div>
        }
        description={`${templateForm.isPinned ? "固定・" : ""}${templateForm.name}・${autoSaveLabel}`}
        title="テンプレート編集"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="名前" wrapWithLabel={false}>
              <CodeEditor
                ariaLabel="名前"
                className="min-h-8.5"
                textClassName="mail-field-text"
                singleLine
                showWhitespace={showWhitespace}
                value={templateForm.name}
                editorSettings={editorSettings}
                onChange={(value) => onChangeTemplate("name", value)}
              />
            </Field>
            <Field label="件名" wrapWithLabel={false}>
              <CodeEditor
                ariaLabel="件名"
                className="min-h-8.5"
                textClassName="mail-field-text"
                singleLine
                showWhitespace={showWhitespace}
                value={templateForm.subject}
                editorSettings={editorSettings}
                onChange={(value) => onChangeTemplate("subject", value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
            <Field label="署名">
              <Select
                value={templateForm.signatureId ?? ""}
                onChange={(event) =>
                  onChangeTemplate("signatureId", event.currentTarget.value || null)
                }
              >
                <option value="">署名なし</option>
                {hasMissingSignature ? (
                  <option value={templateForm.signatureId ?? ""}>ゴミ箱の署名</option>
                ) : null}
                {signatures.map((signature) => (
                  <option key={signature.id} value={signature.id}>
                    {signature.name}
                    {signature.isDefault ? " (既定)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
              {"`{{相手名}}` や `{{日付}}` をそのまま保存できます。"}
            </div>
          </div>

          <Field hint="社名や担当者など" label="宛名メモ" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="宛名メモ"
              className="min-h-24"
              textClassName="mail-compose-text"
              placeholder={"株式会社〇〇\n営業部\n佐藤 様"}
              showWhitespace={showWhitespace}
              value={templateForm.recipient}
              editorSettings={editorSettings}
              onChange={(value) => onChangeTemplate("recipient", value)}
            />
          </Field>

          <Field label="書き出し" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="書き出し"
              className="min-h-33"
              textClassName="mail-compose-text"
              showWhitespace={showWhitespace}
              value={templateForm.opening}
              editorSettings={editorSettings}
              onChange={(value) => onChangeTemplate("opening", value)}
            />
          </Field>

          <Field label="本文" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="本文"
              className="min-h-70"
              textClassName="mail-compose-text"
              showWhitespace={showWhitespace}
              value={templateForm.body}
              editorSettings={editorSettings}
              onChange={(value) => onChangeTemplate("body", value)}
            />
          </Field>

          <Field label="結び" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="結び"
              className="min-h-33"
              textClassName="mail-compose-text"
              showWhitespace={showWhitespace}
              value={templateForm.closing}
              editorSettings={editorSettings}
              onChange={(value) => onChangeTemplate("closing", value)}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

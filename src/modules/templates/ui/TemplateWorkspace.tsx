import { type ReactNode, useState } from "react";

import { truncate } from "../../../shared/lib/text";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button, Field, Input, Panel, Select, Textarea } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template, TemplateInput } from "../model";

interface TemplateWorkspaceProps {
  templates: Template[];
  signatures: Signature[];
  selectedTemplateId: string | null;
  templateForm: TemplateInput;
  previewText: string;
  showWhitespace: boolean;
  onSelectTemplate: (id: string) => void;
  onCreateTemplate: () => void;
  onChangeTemplate: <K extends keyof TemplateInput>(field: K, value: TemplateInput[K]) => void;
  onSaveTemplate: () => Promise<void>;
  onDeleteTemplate: () => Promise<void>;
  onStartDraftFromTemplate: () => void;
}

export function TemplateWorkspace({
  templates,
  signatures,
  selectedTemplateId,
  templateForm,
  previewText,
  showWhitespace,
  onSelectTemplate,
  onCreateTemplate,
  onChangeTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onStartDraftFromTemplate,
}: TemplateWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const canExpandPreview = previewText.trim().length > 0 || templateForm.subject.trim().length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
    "テンプレートのプレビューがここに表示されます。";

  return (
    <>
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <Button size="sm" variant="ghost" onClick={onCreateTemplate}>
                New
              </Button>
            }
            description={`${templates.length} templates`}
            title="Template list"
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {templates.map((template) => {
                const isActive = template.id === selectedTemplateId;

                return (
                  <button
                    key={template.id}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "border-[var(--color-list-active-border)] bg-[var(--color-list-active-bg)]"
                        : "border-transparent hover:border-[var(--color-list-hover-border)] hover:bg-[var(--color-list-hover-bg)]"
                    }`}
                    onClick={() => onSelectTemplate(template.id)}
                    type="button"
                  >
                    <div className="truncate text-sm font-medium text-[var(--color-text-strong)]">
                      {template.name}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                      {truncate(template.subject || "件名未設定")}
                    </div>
                    <div className="mt-2 text-[11px] text-[var(--color-text-subtle)]">
                      {formatStoredTime(template.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => void onDeleteTemplate()}>
                  {selectedTemplateId ? "Delete" : "Reset"}
                </Button>
                <Button size="sm" variant="primary" onClick={() => void onSaveTemplate()}>
                  Save
                </Button>
              </div>
            }
            description={templateForm.name}
            title="Template editor"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <Input
                    showWhitespace={showWhitespace}
                    value={templateForm.name}
                    onChange={(event) => onChangeTemplate("name", event.currentTarget.value)}
                  />
                </Field>
                <Field label="Subject">
                  <Input
                    showWhitespace={showWhitespace}
                    value={templateForm.subject}
                    onChange={(event) => onChangeTemplate("subject", event.currentTarget.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <Field label="Signature">
                  <Select
                    value={templateForm.signatureId ?? ""}
                    onChange={(event) =>
                      onChangeTemplate("signatureId", event.currentTarget.value || null)
                    }
                  >
                    <option value="">署名なし</option>
                    {signatures.map((signature) => (
                      <option key={signature.id} value={signature.id}>
                        {signature.name}
                        {signature.isDefault ? " (既定)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="rounded-lg border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
                  {"`{{相手名}}` や `{{日付}}` をそのまま保存できます。"}
                </div>
              </div>

              <Field label="Opening">
                <Textarea
                  className="min-h-[144px]"
                  rows={5}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.opening}
                  onChange={(event) => onChangeTemplate("opening", event.currentTarget.value)}
                />
              </Field>

              <Field label="Body">
                <Textarea
                  className="min-h-[320px]"
                  rows={12}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.body}
                  onChange={(event) => onChangeTemplate("body", event.currentTarget.value)}
                />
              </Field>

              <Field label="Closing">
                <Textarea
                  className="min-h-[144px]"
                  rows={5}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.closing}
                  onChange={(event) => onChangeTemplate("closing", event.currentTarget.value)}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <div className="flex gap-2">
                <Button
                  disabled={!canExpandPreview}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsWidePreviewOpen(true)}
                >
                  Expand
                </Button>
                <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
                  Start draft
                </Button>
              </div>
            }
            description="Rendered preview"
            title="Preview"
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-[var(--color-panel-border-strong)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                Subject
              </div>
              <div className="mt-2 text-sm text-[var(--color-text-strong)]">
                {templateForm.subject || "件名未設定"}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                Body
              </div>
              <pre className="mail-preview-text mt-2 overflow-x-auto rounded-lg border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] px-4 py-4 whitespace-pre-wrap text-[var(--color-preview-text)]">
                {previewBodyText}
              </pre>
            </div>
          </div>
        </Panel>
      </div>

      <PreviewOverlay
        action={
          <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
            Start draft
          </Button>
        }
        description="Rendered preview"
        isOpen={isWidePreviewOpen}
        title="Template preview"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
              Subject
            </div>
            <div className="mt-3 text-sm text-[var(--color-text-strong)]">
              {templateForm.subject || "件名未設定"}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
              Body
            </div>
            <pre className="mail-preview-text mt-3 min-h-[520px] overflow-x-auto whitespace-pre-wrap text-[var(--color-preview-text)]">
              {previewBodyText}
            </pre>
          </section>
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
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--color-panel-border-strong)] px-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-text-strong)]">{title}</div>
        <div className="truncate text-xs text-[var(--color-text-subtle)]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

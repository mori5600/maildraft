import type { ReactNode } from "react";

import { truncate } from "../../../shared/lib/text";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
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
  return (
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
                      ? "border-[#314778] bg-[#161f31]"
                      : "border-transparent hover:border-[#232831] hover:bg-[#181d24]"
                  }`}
                  onClick={() => onSelectTemplate(template.id)}
                  type="button"
                >
                  <div className="truncate text-sm font-medium text-[#eef2f7]">{template.name}</div>
                  <div className="mt-1 truncate text-xs text-[#8a93a3]">
                    {truncate(template.subject || "件名未設定")}
                  </div>
                  <div className="mt-2 text-[11px] text-[#667082]">
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

              <div className="rounded-lg border border-[#20242c] bg-[#0f1319] px-3 py-3 text-sm text-[#8a93a3]">
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
            <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
              Start draft
            </Button>
          }
          description="Rendered preview"
          title="Preview"
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[#20242c] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#667082]">Subject</div>
            <div className="mt-2 text-sm text-[#eef2f7]">
              {templateForm.subject || "件名未設定"}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#667082]">Body</div>
            <pre className="mail-preview-text mt-2 overflow-x-auto rounded-lg border border-[#20242c] bg-[#0d1016] px-4 py-4 whitespace-pre-wrap text-[#d7dce5]">
              {(showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
                "テンプレートのプレビューがここに表示されます。"}
            </pre>
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
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#20242c] px-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[#eef2f7]">{title}</div>
        <div className="truncate text-xs text-[#667082]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

import type { ReactNode } from "react";

import { truncate } from "../../../shared/lib/text";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { Button, Field, Input, Panel, Select, Textarea } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template } from "../../templates/model";
import type { Draft, DraftInput } from "../model";
import { draftLabel } from "../model";

interface DraftWorkspaceProps {
  drafts: Draft[];
  templates: Template[];
  signatures: Signature[];
  selectedDraftId: string | null;
  draftForm: DraftInput;
  previewText: string;
  checks: string[];
  showWhitespace: boolean;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onChangeDraft: <K extends keyof DraftInput>(field: K, value: DraftInput[K]) => void;
  onCopyPreview: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onDeleteDraft: () => Promise<void>;
  onApplyTemplate: (templateId: string) => void;
}

export function DraftWorkspace({
  drafts,
  templates,
  signatures,
  selectedDraftId,
  draftForm,
  previewText,
  checks,
  showWhitespace,
  onSelectDraft,
  onCreateDraft,
  onChangeDraft,
  onCopyPreview,
  onSaveDraft,
  onDeleteDraft,
  onApplyTemplate,
}: DraftWorkspaceProps) {
  const selectedSignature = signatures.find((signature) => signature.id === draftForm.signatureId);
  const canCopyPreview = previewText.trim().length > 0;

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            <Button size="sm" variant="ghost" onClick={onCreateDraft}>
              New
            </Button>
          }
          description={`${drafts.length} drafts`}
          title="Draft list"
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {drafts.map((draft) => {
              const isActive = draft.id === selectedDraftId;

              return (
                <button
                  key={draft.id}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "border-[#314778] bg-[#161f31]"
                      : "border-transparent hover:border-[#232831] hover:bg-[#181d24]"
                  }`}
                  onClick={() => onSelectDraft(draft.id)}
                  type="button"
                >
                  <div className="truncate text-sm font-medium text-[#eef2f7]">
                    {draftLabel(draft)}
                  </div>
                  <div className="mt-1 truncate text-xs text-[#8a93a3]">
                    {truncate(draft.subject || "件名未設定")}
                  </div>
                  <div className="mt-2 text-[11px] text-[#667082]">
                    {formatStoredTime(draft.updatedAt)}
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
              <Button size="sm" variant="ghost" onClick={() => void onDeleteDraft()}>
                {selectedDraftId ? "Delete" : "Reset"}
              </Button>
              <Button size="sm" variant="primary" onClick={() => void onSaveDraft()}>
                Save
              </Button>
            </div>
          }
          description={draftLabel(draftForm)}
          title="Editor"
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Label">
                <Input
                  placeholder="4/12 打ち合わせお礼"
                  showWhitespace={showWhitespace}
                  value={draftForm.title}
                  onChange={(event) => onChangeDraft("title", event.currentTarget.value)}
                />
              </Field>
              <Field label="Subject">
                <Input
                  placeholder="件名"
                  showWhitespace={showWhitespace}
                  value={draftForm.subject}
                  onChange={(event) => onChangeDraft("subject", event.currentTarget.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template">
                <Select
                  value={draftForm.templateId ?? ""}
                  onChange={(event) => {
                    const templateId = event.currentTarget.value;
                    if (!templateId) {
                      onChangeDraft("templateId", null);
                      return;
                    }

                    onApplyTemplate(templateId);
                  }}
                >
                  <option value="">テンプレートなし</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Signature">
                <Select
                  value={draftForm.signatureId ?? ""}
                  onChange={(event) =>
                    onChangeDraft("signatureId", event.currentTarget.value || null)
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
            </div>

            <Field label="Recipient note" hint="社名や担当者など">
              <Input
                placeholder="株式会社サンプル 佐藤様"
                showWhitespace={showWhitespace}
                value={draftForm.recipient}
                onChange={(event) => onChangeDraft("recipient", event.currentTarget.value)}
              />
            </Field>

            <Field label="Opening">
              <Textarea
                className="min-h-[144px]"
                placeholder={"株式会社サンプル\n佐藤 様"}
                rows={5}
                showWhitespace={showWhitespace}
                textClassName="mail-compose-text"
                value={draftForm.opening}
                onChange={(event) => onChangeDraft("opening", event.currentTarget.value)}
              />
            </Field>

            <Field label="Body">
              <Textarea
                className="min-h-[320px]"
                placeholder="本文"
                rows={12}
                showWhitespace={showWhitespace}
                textClassName="mail-compose-text"
                value={draftForm.body}
                onChange={(event) => onChangeDraft("body", event.currentTarget.value)}
              />
            </Field>

            <Field label="Closing">
              <Textarea
                className="min-h-[144px]"
                placeholder="引き続きよろしくお願いいたします。"
                rows={5}
                showWhitespace={showWhitespace}
                textClassName="mail-compose-text"
                value={draftForm.closing}
                onChange={(event) => onChangeDraft("closing", event.currentTarget.value)}
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            <Button
              disabled={!canCopyPreview}
              size="sm"
              variant="ghost"
              onClick={() => void onCopyPreview()}
            >
              Copy
            </Button>
          }
          description={selectedSignature?.name ?? "署名なし"}
          title="Preview"
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[#20242c] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#667082]">Subject</div>
            <div className="mt-2 text-sm text-[#eef2f7]">{draftForm.subject || "件名未設定"}</div>
          </div>

          <div className="border-b border-[#20242c] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#667082]">Checks</div>
            <div className="mt-2 space-y-2">
              {checks.map((check) => (
                <div
                  key={check}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    check.includes("通っています")
                      ? "border-[#20352c] bg-[#121a16] text-[#98d5b7]"
                      : "border-[#3a3423] bg-[#18150f] text-[#d8c18a]"
                  }`}
                >
                  {check}
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#667082]">Body</div>
            <pre className="mail-preview-text mt-2 overflow-x-auto rounded-lg border border-[#20242c] bg-[#0d1016] px-4 py-4 whitespace-pre-wrap text-[#d7dce5]">
              {(showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
                "本文プレビューがここに表示されます。"}
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

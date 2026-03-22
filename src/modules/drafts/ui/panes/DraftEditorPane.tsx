import { useEffect, useRef } from "react";

import { CodeEditor } from "../../../../shared/ui/code-editor/CodeEditor";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Panel, Select } from "../../../../shared/ui/primitives";
import type { Signature } from "../../../signatures/model";
import type { Template } from "../../../templates/model";
import type { DraftInput } from "../../model";
import { draftLabel } from "../../model";
import type { DraftProofreadingIssue } from "../../proofreading/model";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

interface DraftEditorPaneProps {
  activeIssue: DraftProofreadingIssue | null;
  activeIssueRequestKey: number;
  draftForm: DraftInput;
  templates: Template[];
  signatures: Signature[];
  selectedDraftId: string | null;
  showWhitespace: boolean;
  autoSaveLabel: string;
  canDuplicate: boolean;
  onChangeDraft: <K extends keyof DraftInput>(field: K, value: DraftInput[K]) => void;
  onDeleteDraft: () => Promise<void>;
  onDuplicateDraft: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onTogglePinned: () => void;
  onApplyTemplate: (templateId: string) => void;
}

export function DraftEditorPane({
  activeIssue,
  activeIssueRequestKey,
  draftForm,
  templates,
  signatures,
  selectedDraftId,
  showWhitespace,
  autoSaveLabel,
  canDuplicate,
  onChangeDraft,
  onDeleteDraft,
  onDuplicateDraft,
  onSaveDraft,
  onTogglePinned,
  onApplyTemplate,
}: DraftEditorPaneProps) {
  const signatureSelectRef = useRef<HTMLSelectElement>(null);
  const hasMissingTemplate = Boolean(
    draftForm.templateId && !templates.some((template) => template.id === draftForm.templateId),
  );
  const hasMissingSignature = Boolean(
    draftForm.signatureId &&
    !signatures.some((signature) => signature.id === draftForm.signatureId),
  );
  const activeIssueField = activeIssue?.field ?? null;

  useEffect(() => {
    if (activeIssueField !== "signature") {
      return;
    }

    signatureSelectRef.current?.focus();
    signatureSelectRef.current?.scrollIntoView({
      block: "center",
    });
  }, [activeIssueField, activeIssueRequestKey]);

  function selectionRequestFor(field: "subject" | "recipient" | "opening" | "body" | "closing") {
    if (activeIssueField !== field) {
      return null;
    }

    const documentLength = draftForm[field].length;
    const from = clamp(activeIssue?.location?.from ?? 0, 0, documentLength);
    const to = clamp(activeIssue?.location?.to ?? from, from, documentLength);

    return {
      from,
      key: activeIssueRequestKey,
      to,
    };
  }

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button size="sm" title="Ctrl/Cmd+Shift+P" variant="ghost" onClick={onTogglePinned}>
              {draftForm.isPinned ? "固定解除" : "固定"}
            </Button>
            <Button
              disabled={!canDuplicate}
              size="sm"
              variant="ghost"
              onClick={() => void onDuplicateDraft()}
            >
              複製
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onDeleteDraft()}>
              {selectedDraftId ? "ゴミ箱へ移動" : "リセット"}
            </Button>
            <Button
              size="sm"
              title="Ctrl/Cmd+S"
              variant="primary"
              onClick={() => void onSaveDraft()}
            >
              保存
            </Button>
          </div>
        }
        description={`${draftForm.isPinned ? "固定・" : ""}${draftLabel(draftForm)}・${autoSaveLabel}`}
        title="編集"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="一覧名" wrapWithLabel={false}>
              <CodeEditor
                ariaLabel="一覧名"
                className="min-h-8.5"
                textClassName="mail-field-text"
                placeholder="4/12 打ち合わせお礼"
                singleLine
                showWhitespace={showWhitespace}
                value={draftForm.title}
                onChange={(value) => onChangeDraft("title", value)}
              />
            </Field>
            <Field label="件名" wrapWithLabel={false}>
              <CodeEditor
                ariaLabel="件名"
                className="min-h-8.5"
                isHighlighted={activeIssueField === "subject"}
                selectionRequest={selectionRequestFor("subject")}
                textClassName="mail-field-text"
                placeholder="件名"
                singleLine
                showWhitespace={showWhitespace}
                value={draftForm.subject}
                onChange={(value) => onChangeDraft("subject", value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="テンプレート">
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
                {hasMissingTemplate ? (
                  <option value={draftForm.templateId ?? ""}>ゴミ箱のテンプレート</option>
                ) : null}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="署名">
              <Select
                className={cn(
                  activeIssueField === "signature" &&
                    "border-(--color-field-focus) shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-focus-ring)]",
                )}
                ref={signatureSelectRef}
                value={draftForm.signatureId ?? ""}
                onChange={(event) =>
                  onChangeDraft("signatureId", event.currentTarget.value || null)
                }
              >
                <option value="">署名なし</option>
                {hasMissingSignature ? (
                  <option value={draftForm.signatureId ?? ""}>ゴミ箱の署名</option>
                ) : null}
                {signatures.map((signature) => (
                  <option key={signature.id} value={signature.id}>
                    {signature.name}
                    {signature.isDefault ? " (既定)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field hint="社名や担当者など" label="宛名メモ" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="宛名メモ"
              className="min-h-24"
              isHighlighted={activeIssueField === "recipient"}
              selectionRequest={selectionRequestFor("recipient")}
              textClassName="mail-compose-text"
              placeholder={"株式会社〇〇\n営業部\n佐藤 様"}
              showWhitespace={showWhitespace}
              value={draftForm.recipient}
              onChange={(value) => onChangeDraft("recipient", value)}
            />
          </Field>

          <Field label="書き出し" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="書き出し"
              className="min-h-33"
              isHighlighted={activeIssueField === "opening"}
              selectionRequest={selectionRequestFor("opening")}
              textClassName="mail-compose-text"
              placeholder={"いつもお世話になっております。\n株式会社△△の田中です。"}
              showWhitespace={showWhitespace}
              value={draftForm.opening}
              onChange={(value) => onChangeDraft("opening", value)}
            />
          </Field>

          <Field label="本文" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="本文"
              className="min-h-70"
              isHighlighted={activeIssueField === "body"}
              selectionRequest={selectionRequestFor("body")}
              textClassName="mail-compose-text"
              placeholder="本文"
              showWhitespace={showWhitespace}
              value={draftForm.body}
              onChange={(value) => onChangeDraft("body", value)}
            />
          </Field>

          <Field label="結び" wrapWithLabel={false}>
            <CodeEditor
              ariaLabel="結び"
              className="min-h-33"
              isHighlighted={activeIssueField === "closing"}
              selectionRequest={selectionRequestFor("closing")}
              textClassName="mail-compose-text"
              placeholder="引き続きよろしくお願いいたします。"
              showWhitespace={showWhitespace}
              value={draftForm.closing}
              onChange={(value) => onChangeDraft("closing", value)}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

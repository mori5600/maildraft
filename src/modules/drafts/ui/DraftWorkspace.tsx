import { type ReactNode, useState } from "react";

import { DRAFT_SORT_OPTIONS, type DraftSortOption } from "../../../shared/lib/list-sort";
import { truncate } from "../../../shared/lib/text";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button, Field, Input, Panel, Select, Textarea } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template } from "../../templates/model";
import type { Draft, DraftHistoryEntry, DraftInput } from "../model";
import { draftLabel } from "../model";
import { DraftHistoryOverlay } from "./DraftHistoryOverlay";

interface DraftWorkspaceProps {
  drafts: Draft[];
  totalDraftCount: number;
  draftHistory: DraftHistoryEntry[];
  templates: Template[];
  signatures: Signature[];
  selectedDraftId: string | null;
  draftForm: DraftInput;
  previewSubject: string;
  previewText: string;
  checks: string[];
  variableNames: string[];
  showWhitespace: boolean;
  autoSaveLabel: string;
  searchQuery: string;
  sort: DraftSortOption;
  canDuplicate: boolean;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: DraftSortOption) => void;
  onChangeDraft: <K extends keyof DraftInput>(field: K, value: DraftInput[K]) => void;
  onChangeDraftVariable: (name: string, value: string) => void;
  onCopyPreview: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onDeleteDraft: () => Promise<void>;
  onDuplicateDraft: () => Promise<void>;
  onTogglePinned: () => void;
  onRestoreDraftHistory: (historyId: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => void;
}

export function DraftWorkspace({
  drafts,
  totalDraftCount,
  draftHistory,
  templates,
  signatures,
  selectedDraftId,
  draftForm,
  previewSubject,
  previewText,
  checks,
  variableNames,
  showWhitespace,
  autoSaveLabel,
  searchQuery,
  sort,
  canDuplicate,
  onSelectDraft,
  onCreateDraft,
  onChangeSearchQuery,
  onChangeSort,
  onChangeDraft,
  onChangeDraftVariable,
  onCopyPreview,
  onSaveDraft,
  onDeleteDraft,
  onDuplicateDraft,
  onTogglePinned,
  onRestoreDraftHistory,
  onApplyTemplate,
}: DraftWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const selectedSignature = signatures.find((signature) => signature.id === draftForm.signatureId);
  const hasMissingTemplate = Boolean(
    draftForm.templateId && !templates.some((template) => template.id === draftForm.templateId),
  );
  const hasMissingSignature = Boolean(
    draftForm.signatureId &&
    !signatures.some((signature) => signature.id === draftForm.signatureId),
  );
  const canCopyPreview = previewText.trim().length > 0;
  const canExpandPreview =
    previewText.trim().length > 0 || draftForm.subject.trim().length > 0 || checks.length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
    "本文プレビューがここに表示されます。";
  const draftCountLabel = searchQuery.trim()
    ? `${drafts.length} / ${totalDraftCount} drafts`
    : `${totalDraftCount} drafts`;

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_320px]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateDraft}>
                New
              </Button>
            }
            description={draftCountLabel}
            title="Draft list"
          />
          <div className="border-b border-[var(--color-panel-border-strong)] px-1.5 py-1.5">
            <div className="grid gap-2 rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-2.5 py-2">
              <div className="grid gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                  Search
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    data-maildraft-search="drafts"
                    placeholder="下書きを検索"
                    title="Ctrl/Cmd+K"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onChangeSearchQuery(event.currentTarget.value)}
                  />
                  <Button
                    disabled={!searchQuery}
                    size="sm"
                    variant="ghost"
                    onClick={() => onChangeSearchQuery("")}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                  Sort
                </div>
                <Select
                  value={sort}
                  onChange={(event) => onChangeSort(event.currentTarget.value as DraftSortOption)}
                >
                  {DRAFT_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {drafts.length === 0 ? (
              <div className="rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-2.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
                {searchQuery.trim()
                  ? "検索に一致する下書きはありません。"
                  : "まだ下書きはありません。"}
              </div>
            ) : (
              <div className="space-y-1">
                {drafts.map((draft) => {
                  const isActive = draft.id === selectedDraftId;

                  return (
                    <button
                      key={draft.id}
                      className={`w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? "border-[var(--color-list-active-border)] bg-[var(--color-list-active-bg)]"
                          : "border-transparent hover:border-[var(--color-list-hover-border)] hover:bg-[var(--color-list-hover-bg)]"
                      }`}
                      onClick={() => onSelectDraft(draft.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[13px] font-medium text-[var(--color-text-strong)]">
                          {draftLabel(draft)}
                        </div>
                        {draft.isPinned ? (
                          <span className="rounded-[6px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                            Pinned
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">
                        {truncate(draft.subject || "件名未設定")}
                      </div>
                      <div className="mt-1.5 text-[10px] text-[var(--color-text-subtle)]">
                        {formatStoredTime(draft.updatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <div className="flex gap-2">
                <Button size="sm" title="Ctrl/Cmd+Shift+P" variant="ghost" onClick={onTogglePinned}>
                  {draftForm.isPinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  disabled={!canDuplicate}
                  size="sm"
                  variant="ghost"
                  onClick={() => void onDuplicateDraft()}
                >
                  Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onDeleteDraft()}>
                  {selectedDraftId ? "Trash" : "Reset"}
                </Button>
                <Button
                  size="sm"
                  title="Ctrl/Cmd+S"
                  variant="primary"
                  onClick={() => void onSaveDraft()}
                >
                  Save
                </Button>
              </div>
            }
            description={`${draftForm.isPinned ? "Pinned · " : ""}${draftLabel(draftForm)} · ${autoSaveLabel}`}
            title="Editor"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
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

              <div className="grid gap-3 md:grid-cols-2">
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
                <Field label="Signature">
                  <Select
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

              <Field label="Recipient note" hint="社名や担当者など">
                <Textarea
                  className="min-h-[96px]"
                  placeholder={"株式会社サンプル\n営業部\n佐藤 様"}
                  rows={3}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={draftForm.recipient}
                  onChange={(event) => onChangeDraft("recipient", event.currentTarget.value)}
                />
              </Field>

              <Field label="Opening">
                <Textarea
                  className="min-h-[132px]"
                  placeholder={"いつもお世話になっております。\n株式会社サンプルの田中です。"}
                  rows={5}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={draftForm.opening}
                  onChange={(event) => onChangeDraft("opening", event.currentTarget.value)}
                />
              </Field>

              <Field label="Body">
                <Textarea
                  className="min-h-[280px]"
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
                  className="min-h-[132px]"
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
              <div className="flex gap-2">
                <Button
                  disabled={draftHistory.length === 0}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsHistoryOpen(true)}
                >
                  History
                </Button>
                <Button
                  disabled={!canExpandPreview}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsWidePreviewOpen(true)}
                >
                  Expand
                </Button>
                <Button
                  disabled={!canCopyPreview}
                  size="sm"
                  title="Ctrl/Cmd+Shift+C"
                  variant="ghost"
                  onClick={() => void onCopyPreview()}
                >
                  Copy
                </Button>
              </div>
            }
            description={
              selectedSignature?.name ?? (hasMissingSignature ? "ゴミ箱の署名を参照中" : "署名なし")
            }
            title="Preview"
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-[var(--color-panel-border-strong)] px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Variables
              </div>
              <div className="mt-2.5 space-y-2.5">
                {variableNames.length === 0 ? (
                  <div className="rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-2.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
                    この下書きには差し込み変数がありません。
                  </div>
                ) : (
                  <>
                    {variableNames.map((name) => (
                      <Field key={name} hint={`{{${name}}}`} label={name}>
                        <Input
                          placeholder={`{{${name}}} に入れる値`}
                          showWhitespace={showWhitespace}
                          value={draftForm.variableValues[name] ?? ""}
                          onChange={(event) =>
                            onChangeDraftVariable(name, event.currentTarget.value)
                          }
                        />
                      </Field>
                    ))}
                    <div className="rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-2.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
                      本文中の <code>{`{{...}}`}</code>{" "}
                      はそのまま保存し、プレビューとコピー時に差し込みます。
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-b border-[var(--color-panel-border-strong)] px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Subject
              </div>
              <div className="mt-1.5 text-[13px] text-[var(--color-text-strong)]">
                {previewSubject || "件名未設定"}
              </div>
            </div>

            <div className="border-b border-[var(--color-panel-border-strong)] px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Checks
              </div>
              <div className="mt-2 space-y-1.5">
                {checks.map((check) => (
                  <div
                    key={check}
                    className={`rounded-[7px] border px-3 py-1.5 text-[13px] ${
                      check.includes("通っています")
                        ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                        : "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                    }`}
                  >
                    {check}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Body
              </div>
              <pre className="mail-preview-text mt-2 overflow-x-auto rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] px-3.5 py-3 whitespace-pre-wrap text-[var(--color-preview-text)]">
                {previewBodyText}
              </pre>
            </div>
          </div>
        </Panel>
      </div>

      <PreviewOverlay
        action={
          <Button
            disabled={!canCopyPreview}
            size="sm"
            title="Ctrl/Cmd+Shift+C"
            variant="ghost"
            onClick={() => void onCopyPreview()}
          >
            Copy
          </Button>
        }
        description={
          selectedSignature?.name ?? (hasMissingSignature ? "ゴミ箱の署名を参照中" : "署名なし")
        }
        isOpen={isWidePreviewOpen}
        title="Draft preview"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
              Body
            </div>
            <pre className="mail-preview-text mt-2.5 min-h-[480px] overflow-x-auto whitespace-pre-wrap text-[var(--color-preview-text)]">
              {previewBodyText}
            </pre>
          </section>

          <div className="space-y-3">
            <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Subject
              </div>
              <div className="mt-2.5 text-[13px] text-[var(--color-text-strong)]">
                {previewSubject || "件名未設定"}
              </div>
            </section>

            <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Checks
              </div>
              <div className="mt-2.5 space-y-1.5">
                {checks.map((check) => (
                  <div
                    key={check}
                    className={`rounded-[7px] border px-3 py-1.5 text-[13px] ${
                      check.includes("通っています")
                        ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                        : "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                    }`}
                  >
                    {check}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </PreviewOverlay>

      <DraftHistoryOverlay
        historyEntries={draftHistory}
        isOpen={isHistoryOpen}
        showWhitespace={showWhitespace}
        signatures={signatures}
        onClose={() => setIsHistoryOpen(false)}
        onRestore={async (historyId) => {
          await onRestoreDraftHistory(historyId);
          setIsHistoryOpen(false);
        }}
      />
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
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-panel-border-strong)] px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--color-text-strong)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--color-text-subtle)]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

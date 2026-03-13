import { type ReactNode, useState } from "react";

import { SIGNATURE_SORT_OPTIONS, type SignatureSortOption } from "../../../shared/lib/list-sort";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button, Field, Input, Panel, Select, Textarea } from "../../../shared/ui/primitives";
import type { Signature, SignatureInput } from "../model";

interface SignatureWorkspaceProps {
  signatures: Signature[];
  totalSignatureCount: number;
  selectedSignatureId: string | null;
  signatureForm: SignatureInput;
  showWhitespace: boolean;
  searchQuery: string;
  sort: SignatureSortOption;
  canDuplicate: boolean;
  onSelectSignature: (id: string) => void;
  onCreateSignature: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: SignatureSortOption) => void;
  onChangeSignature: <K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) => void;
  onSaveSignature: () => Promise<void>;
  onDeleteSignature: () => Promise<void>;
  onDuplicateSignature: () => Promise<void>;
  onTogglePinned: () => void;
}

export function SignatureWorkspace({
  signatures,
  totalSignatureCount,
  selectedSignatureId,
  signatureForm,
  showWhitespace,
  searchQuery,
  sort,
  canDuplicate,
  onSelectSignature,
  onCreateSignature,
  onChangeSearchQuery,
  onChangeSort,
  onChangeSignature,
  onSaveSignature,
  onDeleteSignature,
  onDuplicateSignature,
  onTogglePinned,
}: SignatureWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const canExpandPreview = signatureForm.body.trim().length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(signatureForm.body) : signatureForm.body) ||
    "署名プレビューがここに表示されます。";
  const signatureCountLabel = searchQuery.trim()
    ? `${signatures.length} / ${totalSignatureCount} signatures`
    : `${totalSignatureCount} signatures`;

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_280px]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateSignature}>
                New
              </Button>
            }
            description={signatureCountLabel}
            title="Signature list"
          />
          <div className="border-b border-(--color-panel-border-strong) px-1.5 py-1.5">
            <div className="grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-2.5 py-2">
              <div className="grid gap-1.5">
                <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                  Search
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    data-maildraft-search="signatures"
                    placeholder="署名を検索"
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
                <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                  Sort
                </div>
                <Select
                  value={sort}
                  onChange={(event) =>
                    onChangeSort(event.currentTarget.value as SignatureSortOption)
                  }
                >
                  {SIGNATURE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {signatures.length === 0 ? (
              <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
                {searchQuery.trim() ? "検索に一致する署名はありません。" : "まだ署名はありません。"}
              </div>
            ) : (
              <div className="space-y-1">
                {signatures.map((signature) => {
                  const isActive = signature.id === selectedSignatureId;

                  return (
                    <button
                      key={signature.id}
                      className={`w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                          : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                      }`}
                      onClick={() => onSelectSignature(signature.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                          {signature.name}
                        </div>
                        {signature.isPinned ? (
                          <span className="rounded-md border border-(--color-panel-border-strong) bg-(--color-field-bg) px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                            Pinned
                          </span>
                        ) : null}
                        {signature.isDefault ? (
                          <span className="rounded-md border border-(--color-default-badge-border) bg-(--color-default-badge-bg) px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-(--color-default-badge-text) uppercase">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                        {formatStoredTime(signature.updatedAt)}
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
                  {signatureForm.isPinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  disabled={!canDuplicate}
                  size="sm"
                  variant="ghost"
                  onClick={() => void onDuplicateSignature()}
                >
                  Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onDeleteSignature()}>
                  {selectedSignatureId ? "Trash" : "Reset"}
                </Button>
                <Button
                  size="sm"
                  title="Ctrl/Cmd+S"
                  variant="primary"
                  onClick={() => void onSaveSignature()}
                >
                  Save
                </Button>
              </div>
            }
            description={`${signatureForm.isPinned ? "Pinned · " : ""}${signatureForm.name}`}
            title="Signature editor"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
            <div className="grid gap-3">
              <Field label="Name">
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

              <Field label="Body">
                <Textarea
                  className="min-h-80"
                  rows={14}
                  showWhitespace={showWhitespace}
                  textClassName="mail-signature-text"
                  value={signatureForm.body}
                  onChange={(event) => onChangeSignature("body", event.currentTarget.value)}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <Button
                disabled={!canExpandPreview}
                size="sm"
                variant="ghost"
                onClick={() => setIsWidePreviewOpen(true)}
              >
                Expand
              </Button>
            }
            description="Rendered block"
            title="Preview"
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
            <pre className="mail-signature-text overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-3.5 py-3 whitespace-pre-wrap text-(--color-preview-text)">
              {previewBodyText}
            </pre>
          </div>
        </Panel>
      </div>

      <PreviewOverlay
        description="Rendered block"
        isOpen={isWidePreviewOpen}
        title="Signature preview"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) p-4">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            Body
          </div>
          <pre className="mail-signature-text mt-2.5 min-h-120 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
            {previewBodyText}
          </pre>
        </section>
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
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-(--color-panel-border-strong) px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-(--color-text-strong)">{title}</div>
        <div className="truncate text-[11px] text-(--color-text-subtle)">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

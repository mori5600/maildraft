import { useMemo, useState } from "react";

import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import { renderDraftPreview, renderDraftSubject } from "../../renderer/render-draft";
import type { Signature } from "../../signatures/model";
import { type DraftHistoryEntry, draftLabel, toDraftInputFromHistory } from "../model";

interface DraftHistoryOverlayProps {
  historyEntries: DraftHistoryEntry[];
  isOpen: boolean;
  showWhitespace: boolean;
  signatures: Signature[];
  onClose: () => void;
  onRestore: (historyId: string) => Promise<void>;
}

export function DraftHistoryOverlay({
  historyEntries,
  isOpen,
  showWhitespace,
  signatures,
  onClose,
  onRestore,
}: DraftHistoryOverlayProps) {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const activeHistoryId = historyEntries.some((entry) => entry.id === selectedHistoryId)
    ? selectedHistoryId
    : (historyEntries[0]?.id ?? null);

  const selectedEntry = useMemo(
    () => historyEntries.find((entry) => entry.id === activeHistoryId) ?? historyEntries[0] ?? null,
    [activeHistoryId, historyEntries],
  );
  const selectedDraftInput = selectedEntry ? toDraftInputFromHistory(selectedEntry) : null;
  const selectedSignature = selectedEntry
    ? signatures.find((signature) => signature.id === selectedEntry.signatureId)
    : undefined;
  const previewSubject = selectedDraftInput ? renderDraftSubject(selectedDraftInput) : "件名未設定";
  const previewText = selectedDraftInput
    ? renderDraftPreview(selectedDraftInput, selectedSignature)
    : "復元できる履歴がありません。";
  const previewBodyText = showWhitespace ? visualizeWhitespace(previewText) : previewText;

  return (
    <PreviewOverlay
      action={
        <Button
          disabled={!selectedEntry}
          size="sm"
          variant="primary"
          onClick={() => (selectedEntry ? void onRestore(selectedEntry.id) : undefined)}
        >
          Restore
        </Button>
      }
      description={`${historyEntries.length} revisions`}
      isOpen={isOpen}
      title="Draft history"
      onClose={onClose}
    >
      <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
        <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Revisions
          </div>
          <div className="mt-2.5 space-y-1.5">
            {historyEntries.length === 0 ? (
              <div className="rounded-[7px] border border-[var(--color-panel-border-strong)] px-3 py-2.5 text-[13px] text-[var(--color-text-muted)]">
                まだ復元できる履歴はありません。
              </div>
            ) : (
              historyEntries.map((entry) => {
                const active = entry.id === selectedEntry?.id;

                return (
                  <button
                    key={entry.id}
                    className={`w-full rounded-[7px] border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-[var(--color-list-active-border)] bg-[var(--color-list-active-bg)]"
                        : "border-transparent hover:border-[var(--color-list-hover-border)] hover:bg-[var(--color-list-hover-bg)]"
                    }`}
                    onClick={() => setSelectedHistoryId(entry.id)}
                    type="button"
                  >
                    <div className="truncate text-[13px] font-medium text-[var(--color-text-strong)]">
                      {draftLabel(entry)}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">
                      {previewLine(entry.subject)}
                    </div>
                    <div className="mt-1.5 text-[10px] text-[var(--color-text-subtle)]">
                      {formatStoredTime(entry.recordedAt)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <div className="grid gap-3">
          <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
              Subject
            </div>
            <div className="mt-2.5 text-[13px] text-[var(--color-text-strong)]">
              {previewSubject || "件名未設定"}
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
              Body
            </div>
            <pre className="mail-preview-text mt-2.5 min-h-[460px] overflow-x-auto whitespace-pre-wrap text-[var(--color-preview-text)]">
              {previewBodyText}
            </pre>
          </section>
        </div>
      </div>
    </PreviewOverlay>
  );
}

function previewLine(value: string): string {
  const line = value.trim() || "件名未設定";
  return line.length > 56 ? `${line.slice(0, 56)}…` : line;
}

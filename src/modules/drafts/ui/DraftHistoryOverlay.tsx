import { useMemo, useState } from "react";

import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import { renderDraftPreview, renderDraftSubject } from "../../renderer/render-draft";
import type { Signature } from "../../signatures/model";
import { type DraftHistoryEntry,draftLabel, toDraftInputFromHistory } from "../model";

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
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
            Revisions
          </div>
          <div className="mt-3 space-y-2">
            {historyEntries.length === 0 ? (
              <div className="rounded-lg border border-[var(--color-panel-border-strong)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
                まだ復元できる履歴はありません。
              </div>
            ) : (
              historyEntries.map((entry) => {
                const active = entry.id === selectedEntry?.id;

                return (
                  <button
                    key={entry.id}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-[var(--color-list-active-border)] bg-[var(--color-list-active-bg)]"
                        : "border-transparent hover:border-[var(--color-list-hover-border)] hover:bg-[var(--color-list-hover-bg)]"
                    }`}
                    onClick={() => setSelectedHistoryId(entry.id)}
                    type="button"
                  >
                    <div className="truncate text-sm font-medium text-[var(--color-text-strong)]">
                      {draftLabel(entry)}
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                      {previewLine(entry.subject)}
                    </div>
                    <div className="mt-2 text-[11px] text-[var(--color-text-subtle)]">
                      {formatStoredTime(entry.recordedAt)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
              Subject
            </div>
            <div className="mt-3 text-sm text-[var(--color-text-strong)]">
              {previewSubject || "件名未設定"}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
              Body
            </div>
            <pre className="mail-preview-text mt-3 min-h-[480px] overflow-x-auto whitespace-pre-wrap text-[var(--color-preview-text)]">
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

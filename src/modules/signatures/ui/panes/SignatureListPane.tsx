import { FlagIcon } from "@heroicons/react/20/solid";
import { memo } from "react";

import { SIGNATURE_SORT_OPTIONS, type SignatureSortOption } from "../../../../shared/lib/list-sort";
import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Select } from "../../../../shared/ui/primitives";
import type { Signature } from "../../model";

interface SignatureListPaneProps {
  signatures: Signature[];
  totalSignatureCount: number;
  selectedSignatureId: string | null;
  searchQuery: string;
  sort: SignatureSortOption;
  onSelectSignature: (id: string) => void;
  onCreateSignature: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: SignatureSortOption) => void;
}

export const SignatureListPane = memo(function SignatureListPane({
  signatures,
  totalSignatureCount,
  selectedSignatureId,
  searchQuery,
  sort,
  onSelectSignature,
  onCreateSignature,
  onChangeSearchQuery,
  onChangeSort,
}: SignatureListPaneProps) {
  const signatureCountLabel = searchQuery.trim()
    ? `${signatures.length} / ${totalSignatureCount}件`
    : `${totalSignatureCount}件`;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateSignature}>
            新規
          </Button>
        }
        description={signatureCountLabel}
        title="署名一覧"
      />
      <div className="border-b border-(--color-panel-border-strong) px-1.5 py-1.5">
        <div className="mail-list-search-panel grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) px-2.5 py-2">
          <div className="grid gap-1.5">
            <div className="mail-list-search-heading">
              <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                検索
              </div>
              <kbd className="mail-shortcut-badge">Ctrl/Cmd+K</kbd>
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
                消去
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              並び順
            </div>
            <Select
              value={sort}
              onChange={(event) => onChangeSort(event.currentTarget.value as SignatureSortOption)}
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
                  className={`mail-list-item w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                      : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                  }`}
                  type="button"
                  onClick={() => onSelectSignature(signature.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                      {signature.name}
                    </div>
                    {signature.isPinned ? (
                      <span
                        aria-label="固定"
                        className="inline-flex rounded-md border border-(--color-panel-border-strong) bg-(--color-field-bg) p-1 text-(--color-text-subtle)"
                        title="固定"
                      >
                        <FlagIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    {signature.isDefault ? (
                      <span className="rounded-md border border-(--color-default-badge-border) bg-(--color-default-badge-bg) px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-(--color-default-badge-text) uppercase">
                        既定
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
  );
});

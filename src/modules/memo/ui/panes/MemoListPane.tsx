import { DocumentTextIcon } from "@heroicons/react/24/outline";

import type { MemoSortOption } from "../../../../shared/lib/list-sort";
import { truncate } from "../../../../shared/lib/text";
import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Select } from "../../../../shared/ui/primitives";
import { type Memo,memoExcerpt, memoLabel } from "../../model";

interface MemoListPaneProps {
  availableSortOptions: Array<{ value: MemoSortOption; label: string }>;
  memos: Memo[];
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: MemoSortOption) => void;
  onCreateMemo: () => void;
  onSelectMemo: (id: string) => void;
  searchQuery: string;
  selectedMemoId: string | null;
  sort: MemoSortOption;
  totalMemoCount: number;
}

export function MemoListPane({
  availableSortOptions,
  memos,
  onChangeSearchQuery,
  onChangeSort,
  onCreateMemo,
  onSelectMemo,
  searchQuery,
  selectedMemoId,
  sort,
  totalMemoCount,
}: MemoListPaneProps) {
  const memoCountLabel = searchQuery.trim()
    ? `${memos.length} / ${totalMemoCount}件`
    : `${totalMemoCount}件`;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateMemo}>
            新規
          </Button>
        }
        description={memoCountLabel}
        title="メモ一覧"
      />

      <div className="border-b border-(--color-panel-border-strong) px-1.5 py-1.5">
        <div className="mail-list-search-panel grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) px-2.5 py-2">
          <div className="grid gap-1.5">
            <div className="mail-list-search-heading">
              <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                Explorer
              </div>
              <kbd className="mail-shortcut-badge">Ctrl/Cmd+K</kbd>
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                data-maildraft-search="memo"
                placeholder="メモを検索"
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
              onChange={(event) => onChangeSort(event.currentTarget.value as MemoSortOption)}
            >
              {availableSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {memos.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            {searchQuery.trim() ? "検索に一致するメモはありません。" : "まだメモはありません。"}
          </div>
        ) : (
          <div className="space-y-1">
            {memos.map((memo) => {
              const isActive = memo.id === selectedMemoId;

              return (
                <button
                  key={memo.id}
                  className={`mail-list-item w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                      : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                  }`}
                  type="button"
                  onClick={() => onSelectMemo(memo.id)}
                >
                  <div className="flex items-start gap-2.5">
                    <DocumentTextIcon
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-(--color-text-subtle)"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                        {memoLabel(memo)}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-(--color-text-muted)">
                        {truncate(memoExcerpt(memo), 42)}
                      </div>
                      <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                        {formatStoredTime(memo.updatedAt)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

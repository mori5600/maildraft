import { FlagIcon } from "@heroicons/react/20/solid";
import { memo } from "react";

import { DRAFT_SORT_OPTIONS, type DraftSortOption } from "../../../../shared/lib/list-sort";
import { truncate } from "../../../../shared/lib/text";
import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Select } from "../../../../shared/ui/primitives";
import { TagBadgeList } from "../../../../shared/ui/TagBadgeList";
import { TagFilterBar } from "../../../../shared/ui/TagFilterBar";
import type { Draft } from "../../model";
import { draftLabel } from "../../model";

interface DraftListPaneProps {
  activeTagFilter: string | null;
  availableTags: string[];
  tagCounts?: Record<string, number>;
  drafts: Draft[];
  totalDraftCount: number;
  selectedDraftId: string | null;
  searchQuery: string;
  sort: DraftSortOption;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: DraftSortOption) => void;
  onChangeTagFilter: (tag: string | null) => void;
}

export const DraftListPane = memo(function DraftListPane({
  activeTagFilter,
  availableTags,
  tagCounts,
  drafts,
  totalDraftCount,
  selectedDraftId,
  searchQuery,
  sort,
  onSelectDraft,
  onCreateDraft,
  onChangeSearchQuery,
  onChangeSort,
  onChangeTagFilter,
}: DraftListPaneProps) {
  const hasActiveFilter = Boolean(searchQuery.trim() || activeTagFilter);
  const draftCountLabel = hasActiveFilter
    ? `${drafts.length} / ${totalDraftCount}件`
    : `${totalDraftCount}件`;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateDraft}>
            新規
          </Button>
        }
        description={draftCountLabel}
        title="下書き一覧"
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
              onChange={(event) => onChangeSort(event.currentTarget.value as DraftSortOption)}
            >
              {DRAFT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <TagFilterBar
            activeTag={activeTagFilter}
            availableTags={availableTags}
            tagCounts={tagCounts}
            onChangeTag={onChangeTagFilter}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {drafts.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            {hasActiveFilter ? "条件に一致する下書きはありません。" : "まだ下書きはありません。"}
          </div>
        ) : (
          <div className="space-y-1">
            {drafts.map((draft) => {
              const isActive = draft.id === selectedDraftId;

              return (
                <button
                  key={draft.id}
                  className={`mail-list-item w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                      : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                  }`}
                  type="button"
                  onClick={() => onSelectDraft(draft.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                      {draftLabel(draft)}
                    </div>
                    {draft.isPinned ? (
                      <span
                        aria-label="固定"
                        className="inline-flex rounded-md border border-(--color-panel-border-strong) bg-(--color-field-bg) p-1 text-(--color-text-subtle)"
                        title="固定"
                      >
                        <FlagIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-(--color-text-muted)">
                    {truncate(draft.subject || "件名未設定")}
                  </div>
                  <TagBadgeList className="mt-1.5" tags={draft.tags} />
                  <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                    {formatStoredTime(draft.updatedAt)}
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

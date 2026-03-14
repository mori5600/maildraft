import { DRAFT_SORT_OPTIONS, type DraftSortOption } from "../../../../shared/lib/list-sort";
import { truncate } from "../../../../shared/lib/text";
import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Select } from "../../../../shared/ui/primitives";
import type { Draft } from "../../model";
import { draftLabel } from "../../model";

interface DraftListPaneProps {
  drafts: Draft[];
  totalDraftCount: number;
  selectedDraftId: string | null;
  searchQuery: string;
  sort: DraftSortOption;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: DraftSortOption) => void;
}

export function DraftListPane({
  drafts,
  totalDraftCount,
  selectedDraftId,
  searchQuery,
  sort,
  onSelectDraft,
  onCreateDraft,
  onChangeSearchQuery,
  onChangeSort,
}: DraftListPaneProps) {
  const draftCountLabel = searchQuery.trim()
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
        <div className="grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-2.5 py-2">
          <div className="grid gap-1.5">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              検索
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
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {drafts.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            {searchQuery.trim() ? "検索に一致する下書きはありません。" : "まだ下書きはありません。"}
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
                      <span className="rounded-md border border-(--color-panel-border-strong) bg-(--color-field-bg) px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                        固定
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-(--color-text-muted)">
                    {truncate(draft.subject || "件名未設定")}
                  </div>
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
}

import { truncate } from "../../../../shared/lib/text";
import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Pill } from "../../../../shared/ui/primitives";
import { TagBadgeList } from "../../../../shared/ui/TagBadgeList";
import { TagFilterBar } from "../../../../shared/ui/TagFilterBar";
import { type ContentBlock, contentBlockCategoryLabel, contentBlockLabel } from "../../model";

interface BlockListPaneProps {
  activeTagFilter: string | null;
  availableTags: string[];
  tagCounts?: Record<string, number>;
  blocks: ContentBlock[];
  onChangeSearchQuery: (value: string) => void;
  onChangeTagFilter: (tag: string | null) => void;
  onCreateBlock: () => void;
  onSelectBlock: (id: string) => void;
  searchQuery: string;
  selectedBlockId: string | null;
  totalBlockCount: number;
}

export function BlockListPane({
  activeTagFilter,
  availableTags,
  tagCounts,
  blocks,
  onChangeSearchQuery,
  onChangeTagFilter,
  onCreateBlock,
  onSelectBlock,
  searchQuery,
  selectedBlockId,
  totalBlockCount,
}: BlockListPaneProps) {
  const hasActiveFilter = Boolean(searchQuery.trim() || activeTagFilter);
  const blockCountLabel = hasActiveFilter
    ? `${blocks.length} / ${totalBlockCount}件`
    : `${totalBlockCount}件`;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateBlock}>
            新規
          </Button>
        }
        description={blockCountLabel}
        title="文面ブロック一覧"
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
                data-maildraft-search="blocks"
                placeholder="ブロックを検索"
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

          <TagFilterBar
            activeTag={activeTagFilter}
            availableTags={availableTags}
            tagCounts={tagCounts}
            onChangeTag={onChangeTagFilter}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {blocks.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            {hasActiveFilter
              ? "条件に一致する文面ブロックはありません。"
              : "まだ文面ブロックはありません。"}
          </div>
        ) : (
          <div className="space-y-1">
            {blocks.map((block) => {
              const isActive = block.id === selectedBlockId;

              return (
                <button
                  key={block.id}
                  className={`mail-list-item w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                      : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                  }`}
                  type="button"
                  onClick={() => onSelectBlock(block.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                      {contentBlockLabel(block)}
                    </div>
                    <Pill tone="neutral">{contentBlockCategoryLabel(block.category)}</Pill>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-(--color-text-muted)">
                    {truncate(block.body || "本文なし", 42)}
                  </div>
                  <TagBadgeList className="mt-1.5" tags={block.tags} />
                  <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                    {formatStoredTime(block.updatedAt)}
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

import { FlagIcon } from "@heroicons/react/20/solid";
import { memo } from "react";

import { TEMPLATE_SORT_OPTIONS, type TemplateSortOption } from "../../../../shared/lib/list-sort";
import { truncate } from "../../../../shared/lib/text";
import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Select } from "../../../../shared/ui/primitives";
import { TagBadgeList } from "../../../../shared/ui/TagBadgeList";
import { TagFilterBar } from "../../../../shared/ui/TagFilterBar";
import type { Template } from "../../model";

interface TemplateListPaneProps {
  activeTagFilter: string | null;
  availableTags: string[];
  templates: Template[];
  totalTemplateCount: number;
  selectedTemplateId: string | null;
  searchQuery: string;
  sort: TemplateSortOption;
  onSelectTemplate: (id: string) => void;
  onCreateTemplate: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: TemplateSortOption) => void;
  onChangeTagFilter: (tag: string | null) => void;
}

export const TemplateListPane = memo(function TemplateListPane({
  activeTagFilter,
  availableTags,
  templates,
  totalTemplateCount,
  selectedTemplateId,
  searchQuery,
  sort,
  onSelectTemplate,
  onCreateTemplate,
  onChangeSearchQuery,
  onChangeSort,
  onChangeTagFilter,
}: TemplateListPaneProps) {
  const hasActiveFilter = Boolean(searchQuery.trim() || activeTagFilter);
  const templateCountLabel = hasActiveFilter
    ? `${templates.length} / ${totalTemplateCount}件`
    : `${totalTemplateCount}件`;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateTemplate}>
            新規
          </Button>
        }
        description={templateCountLabel}
        title="テンプレート一覧"
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
                data-maildraft-search="templates"
                placeholder="テンプレートを検索"
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
              onChange={(event) => onChangeSort(event.currentTarget.value as TemplateSortOption)}
            >
              {TEMPLATE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <TagFilterBar
            activeTag={activeTagFilter}
            availableTags={availableTags}
            onChangeTag={onChangeTagFilter}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {templates.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            {hasActiveFilter
              ? "条件に一致するテンプレートはありません。"
              : "まだテンプレートはありません。"}
          </div>
        ) : (
          <div className="space-y-1">
            {templates.map((template) => {
              const isActive = template.id === selectedTemplateId;

              return (
                <button
                  key={template.id}
                  className={`mail-list-item w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                      : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                  }`}
                  type="button"
                  onClick={() => onSelectTemplate(template.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                      {template.name}
                    </div>
                    {template.isPinned ? (
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
                    {truncate(template.subject || "件名未設定")}
                  </div>
                  <TagBadgeList className="mt-1.5" tags={template.tags} />
                  <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                    {formatStoredTime(template.updatedAt)}
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

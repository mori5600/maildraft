import { DocumentTextIcon } from "@heroicons/react/24/outline";

import type { MemoSortOption } from "../../../shared/lib/list-sort";
import { truncate } from "../../../shared/lib/text";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { CodeEditor } from "../../../shared/ui/code-editor/CodeEditor";
import { PaneHeader } from "../../../shared/ui/PaneHeader";
import { Button, Input, Panel, Select } from "../../../shared/ui/primitives";
import { type Memo, memoExcerpt, type MemoInput,memoLabel } from "../model";

interface MemoWorkspaceProps {
  activeMemoUpdatedAt: string | null;
  autoSaveLabel: string;
  availableSortOptions: Array<{ value: MemoSortOption; label: string }>;
  memos: Memo[];
  memoForm: MemoInput;
  onChangeMemo: <K extends keyof MemoInput>(field: K, value: MemoInput[K]) => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: MemoSortOption) => void;
  onCreateMemo: () => void;
  onDeleteMemo: () => Promise<void>;
  onSaveMemo: () => Promise<void>;
  onSelectMemo: (id: string) => void;
  searchQuery: string;
  selectedMemoId: string | null;
  showWhitespace: boolean;
  sort: MemoSortOption;
  totalMemoCount: number;
}

export function MemoWorkspace({
  activeMemoUpdatedAt,
  autoSaveLabel,
  availableSortOptions,
  memos,
  memoForm,
  onChangeMemo,
  onChangeSearchQuery,
  onChangeSort,
  onCreateMemo,
  onDeleteMemo,
  onSaveMemo,
  onSelectMemo,
  searchQuery,
  selectedMemoId,
  showWhitespace,
  sort,
  totalMemoCount,
}: MemoWorkspaceProps) {
  const memoCountLabel = searchQuery.trim()
    ? `${memos.length} / ${totalMemoCount}件`
    : `${totalMemoCount}件`;
  const lineCount = Math.max(1, memoForm.body.split(/\r\n|\r|\n/).length);
  const characterCount = memoForm.title.length + memoForm.body.length;
  const previewBody = showWhitespace ? visualizeWhitespace(memoForm.body) : memoForm.body;

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[268px_minmax(0,1fr)]">
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

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            <div className="flex gap-2">
              <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateMemo}>
                新規
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void onDeleteMemo()}>
                {selectedMemoId ? "削除" : "リセット"}
              </Button>
              <Button
                size="sm"
                title="Ctrl/Cmd+S"
                variant="primary"
                onClick={() => void onSaveMemo()}
              >
                保存
              </Button>
            </div>
          }
          description={autoSaveLabel}
          title="メモエディタ"
        />

        <div className="mail-note-editor-shell min-h-0 flex-1 overflow-hidden">
          <div className="mail-note-titlebar">
            <DocumentTextIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-(--color-text-subtle)"
            />
            <Input
              aria-label="メモタイトル"
              className="mail-note-title-input flex-1"
              placeholder="タイトル"
              value={memoForm.title}
              onChange={(event) => onChangeMemo("title", event.currentTarget.value)}
            />
          </div>

          <div className="flex min-h-0 flex-1">
            <CodeEditor
              ariaLabel="メモ本文"
              className="mail-note-editor-frame h-full min-h-[24rem] flex-1 xl:min-h-[32rem]"
              placeholder="箇条書き、会話ログ、確認事項、メール化前の断片を書き留めます。"
              showLineNumbers
              showWhitespace={showWhitespace}
              textClassName="mail-note-editor-text"
              value={memoForm.body}
              onChange={(value) => onChangeMemo("body", value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-(--color-panel-border-strong) bg-(--color-sidebar-bg) px-4 py-2 text-[11px] text-(--color-text-muted)">
          <div>行 {lineCount}</div>
          <div>文字 {characterCount}</div>
          <div>{activeMemoUpdatedAt ? `保存: ${formatStoredTime(activeMemoUpdatedAt)}` : "未保存"}</div>
          <div className="ml-auto truncate text-(--color-text-subtle)">
            {previewBody.trim() ? truncate(previewBody.replace(/\s+/g, " "), 64) : "本文なし"}
          </div>
        </div>
      </Panel>
    </div>
  );
}

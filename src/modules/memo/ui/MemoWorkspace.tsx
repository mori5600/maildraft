import type { MemoSortOption } from "../../../shared/lib/list-sort";
import type { EditorSettings } from "../../../shared/ui/code-editor/editor-settings";
import type { Memo, MemoInput } from "../model";
import { MemoEditorPane } from "./panes/MemoEditorPane";
import { MemoListPane } from "./panes/MemoListPane";

interface MemoWorkspaceProps {
  activeTagFilter: string | null;
  activeMemoUpdatedAt: string | null;
  autoSaveLabel: string;
  availableTags: string[];
  tagCounts?: Record<string, number>;
  availableSortOptions: Array<{ value: MemoSortOption; label: string }>;
  canStartDraftFromMemo: boolean;
  memos: Memo[];
  memoForm: MemoInput;
  editorSettings?: EditorSettings;
  onChangeMemo: <K extends keyof MemoInput>(field: K, value: MemoInput[K]) => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: MemoSortOption) => void;
  onChangeTagFilter: (tag: string | null) => void;
  onCreateMemo: () => void;
  onDeleteMemo: (memoId?: string) => Promise<void>;
  onSaveMemo: () => Promise<void>;
  onSelectMemo: (id: string) => void;
  onTogglePinned: (memoId?: string) => void | Promise<void>;
  onStartDraftFromMemo: (memoId?: string) => void;
  searchQuery: string;
  selectedMemoId: string | null;
  showWhitespace: boolean;
  sort: MemoSortOption;
  totalMemoCount: number;
}

export function MemoWorkspace({
  activeTagFilter,
  activeMemoUpdatedAt,
  autoSaveLabel,
  availableTags,
  tagCounts,
  availableSortOptions,
  canStartDraftFromMemo,
  memos,
  memoForm,
  editorSettings,
  onChangeMemo,
  onChangeSearchQuery,
  onChangeSort,
  onChangeTagFilter,
  onCreateMemo,
  onDeleteMemo,
  onSaveMemo,
  onSelectMemo,
  onTogglePinned,
  onStartDraftFromMemo,
  searchQuery,
  selectedMemoId,
  showWhitespace,
  sort,
  totalMemoCount,
}: MemoWorkspaceProps) {
  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[268px_minmax(0,1fr)]">
      <MemoListPane
        activeTagFilter={activeTagFilter}
        availableTags={availableTags}
        tagCounts={tagCounts}
        availableSortOptions={availableSortOptions}
        memos={memos}
        onChangeSearchQuery={onChangeSearchQuery}
        onChangeSort={onChangeSort}
        onChangeTagFilter={onChangeTagFilter}
        onCreateMemo={onCreateMemo}
        onDeleteMemo={(memoId) => onDeleteMemo(memoId)}
        onSelectMemo={onSelectMemo}
        onStartDraftFromMemo={(memoId) => onStartDraftFromMemo(memoId)}
        onTogglePinned={(memoId) => onTogglePinned(memoId)}
        searchQuery={searchQuery}
        selectedMemoId={selectedMemoId}
        sort={sort}
        totalMemoCount={totalMemoCount}
      />

      <MemoEditorPane
        activeMemoUpdatedAt={activeMemoUpdatedAt}
        autoSaveLabel={autoSaveLabel}
        availableTags={availableTags}
        canStartDraftFromMemo={canStartDraftFromMemo}
        editorSettings={editorSettings}
        memoForm={memoForm}
        onChangeMemo={onChangeMemo}
        onCreateMemo={onCreateMemo}
        onDeleteMemo={() => onDeleteMemo()}
        onSaveMemo={onSaveMemo}
        onTogglePinned={() => onTogglePinned()}
        onStartDraftFromMemo={() => onStartDraftFromMemo()}
        selectedMemoId={selectedMemoId}
        showWhitespace={showWhitespace}
      />
    </div>
  );
}

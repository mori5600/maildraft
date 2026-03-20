import type { MemoSortOption } from "../../../shared/lib/list-sort";
import type { Memo, MemoInput } from "../model";
import { MemoEditorPane } from "./panes/MemoEditorPane";
import { MemoListPane } from "./panes/MemoListPane";

interface MemoWorkspaceProps {
  activeMemoUpdatedAt: string | null;
  autoSaveLabel: string;
  availableSortOptions: Array<{ value: MemoSortOption; label: string }>;
  canStartDraftFromMemo: boolean;
  memos: Memo[];
  memoForm: MemoInput;
  onChangeMemo: <K extends keyof MemoInput>(field: K, value: MemoInput[K]) => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: MemoSortOption) => void;
  onCreateMemo: () => void;
  onDeleteMemo: () => Promise<void>;
  onSaveMemo: () => Promise<void>;
  onSelectMemo: (id: string) => void;
  onStartDraftFromMemo: () => void;
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
  canStartDraftFromMemo,
  memos,
  memoForm,
  onChangeMemo,
  onChangeSearchQuery,
  onChangeSort,
  onCreateMemo,
  onDeleteMemo,
  onSaveMemo,
  onSelectMemo,
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
        availableSortOptions={availableSortOptions}
        memos={memos}
        onChangeSearchQuery={onChangeSearchQuery}
        onChangeSort={onChangeSort}
        onCreateMemo={onCreateMemo}
        onSelectMemo={onSelectMemo}
        searchQuery={searchQuery}
        selectedMemoId={selectedMemoId}
        sort={sort}
        totalMemoCount={totalMemoCount}
      />

      <MemoEditorPane
        activeMemoUpdatedAt={activeMemoUpdatedAt}
        autoSaveLabel={autoSaveLabel}
        canStartDraftFromMemo={canStartDraftFromMemo}
        memoForm={memoForm}
        onChangeMemo={onChangeMemo}
        onCreateMemo={onCreateMemo}
        onDeleteMemo={onDeleteMemo}
        onSaveMemo={onSaveMemo}
        onStartDraftFromMemo={onStartDraftFromMemo}
        selectedMemoId={selectedMemoId}
        showWhitespace={showWhitespace}
      />
    </div>
  );
}

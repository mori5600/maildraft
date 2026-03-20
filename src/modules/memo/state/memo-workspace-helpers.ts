import { type MemoSortOption, sortMemos } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createEmptyMemo,
  type Memo,
  memoHasMeaningfulContent,
  type MemoInput,
  memoMatchesPersistedMemo,
  toMemoInput,
} from "../model";

export type MemoAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface MemoSelectionState {
  selectedMemoId: string | null;
  memoForm: MemoInput;
}

export interface InitialMemoState extends MemoSelectionState {
  autoSaveState: MemoAutoSaveState;
}

export function findMemo(snapshot: StoreSnapshot, memoId: string | null): Memo | null {
  if (!memoId) {
    return null;
  }

  return snapshot.memos.find((memo) => memo.id === memoId) ?? null;
}

export function buildMemoEditingState(
  snapshot: StoreSnapshot,
  preferredMemoId: string | null = null,
): MemoSelectionState {
  const selectedMemo = findMemo(snapshot, preferredMemoId) ?? snapshot.memos[0] ?? null;

  return {
    selectedMemoId: selectedMemo?.id ?? null,
    memoForm: selectedMemo ? toMemoInput(selectedMemo) : createEmptyMemo(),
  };
}

export function createInitialMemoState(snapshot: StoreSnapshot): InitialMemoState {
  const nextState = buildMemoEditingState(snapshot);

  return {
    ...nextState,
    autoSaveState: nextState.selectedMemoId ? "saved" : "idle",
  };
}

export function filterMemos(
  memos: Memo[],
  searchQuery: string,
  sort: MemoSortOption,
): Memo[] {
  const searchTokens = createSearchTokens(searchQuery);

  return sortMemos(
    searchTokens.length === 0
      ? memos
      : memos.filter((memo) =>
          matchesSearchTokens(searchTokens, buildSearchHaystack([memo.title, memo.body])),
        ),
    sort,
  );
}

export function formatMemoAutoSaveState(state: MemoAutoSaveState): string {
  switch (state) {
    case "idle":
      return "自動保存待機中";
    case "dirty":
      return "未保存の変更があります";
    case "saving":
      return "自動保存しています";
    case "saved":
      return "自動保存済み";
    case "error":
      return "自動保存に失敗しました";
  }
}

export function shouldAutoPersistMemo(input: MemoInput, snapshot: StoreSnapshot): boolean {
  const persistedMemo = snapshot.memos.find((memo) => memo.id === input.id) ?? null;

  if (!persistedMemo && !memoHasMeaningfulContent(input)) {
    return false;
  }

  return !memoMatchesPersistedMemo(input, persistedMemo);
}

export function getMemoUpdatedAt(
  memos: Memo[],
  selectedMemoId: string | null,
): string | null {
  return memos.find((memo) => memo.id === selectedMemoId)?.updatedAt ?? null;
}

export function toMemoWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

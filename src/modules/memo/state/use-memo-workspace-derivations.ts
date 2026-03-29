import { useMemo } from "react";

import type { MemoSortOption } from "../../../shared/lib/list-sort";
import {
  collectTagCounts,
  collectUniqueTags,
  resolveActiveTagFilter,
} from "../../../shared/lib/tags";
import type { StoreSnapshot } from "../../../shared/types/store";
import { memoHasDraftContent, type MemoInput } from "../model";
import { filterMemos, getMemoUpdatedAt } from "./memo-workspace-helpers";

interface UseMemoWorkspaceDerivationsOptions {
  deferredMemoSearchQuery: string;
  memoForm: MemoInput;
  memoSort: MemoSortOption;
  requestedTagFilter: string | null;
  selectedMemoId: string | null;
  snapshot: StoreSnapshot;
}

export function useMemoWorkspaceDerivations({
  deferredMemoSearchQuery,
  memoForm,
  memoSort,
  requestedTagFilter,
  selectedMemoId,
  snapshot,
}: UseMemoWorkspaceDerivationsOptions) {
  const availableMemoTagCounts = useMemo(() => collectTagCounts(snapshot.memos), [snapshot.memos]);
  const availableMemoTags = useMemo(() => collectUniqueTags(snapshot.memos), [snapshot.memos]);
  const activeMemoTagFilter = useMemo(
    () => resolveActiveTagFilter(availableMemoTags, requestedTagFilter),
    [availableMemoTags, requestedTagFilter],
  );
  const filteredMemos = useMemo(
    () => filterMemos(snapshot.memos, deferredMemoSearchQuery, memoSort, activeMemoTagFilter),
    [activeMemoTagFilter, deferredMemoSearchQuery, memoSort, snapshot.memos],
  );
  const selectedMemoUpdatedAt = useMemo(
    () => getMemoUpdatedAt(snapshot.memos, selectedMemoId),
    [selectedMemoId, snapshot.memos],
  );
  const canStartDraftFromMemo = useMemo(() => memoHasDraftContent(memoForm), [memoForm]);

  return {
    activeMemoTagFilter,
    availableMemoTagCounts,
    availableMemoTags,
    canStartDraftFromMemo,
    filteredMemos,
    selectedMemoUpdatedAt,
  };
}

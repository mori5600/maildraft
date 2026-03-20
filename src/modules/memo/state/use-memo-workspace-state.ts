import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { MEMO_SORT_OPTIONS, type MemoSortOption, sortMemos } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import { applyDeletedMemoResult } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { createEmptyMemo, type MemoInput, toMemoInput } from "../model";
import {
  buildMemoEditingState,
  createInitialMemoState,
  toMemoWorkspaceErrorMessage,
} from "./memo-workspace-helpers";
import { useMemoAutoSave } from "./use-memo-auto-save";

export interface MemoWorkspaceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  onViewChange: (view: WorkspaceView) => void;
  snapshot: StoreSnapshot;
}

export function useMemoWorkspaceState({
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
  onViewChange,
  snapshot,
}: MemoWorkspaceStateOptions) {
  const [initialMemoState] = useState(() => createInitialMemoState(snapshot));
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(
    initialMemoState.selectedMemoId,
  );
  const [memoForm, setMemoForm] = useState<MemoInput>(initialMemoState.memoForm);
  const [memoSearchQuery, setMemoSearchQuery] = useState("");
  const [memoSort, setMemoSort] = useState<MemoSortOption>("recent");
  const deferredMemoSearchQuery = useDeferredValue(memoSearchQuery);
  const memoFormRef = useRef(memoForm);
  const selectedMemoIdRef = useRef(selectedMemoId);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    memoFormRef.current = memoForm;
  }, [memoForm]);

  useEffect(() => {
    selectedMemoIdRef.current = selectedMemoId;
  }, [selectedMemoId]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const memoSearchTokens = useMemo(
    () => createSearchTokens(deferredMemoSearchQuery),
    [deferredMemoSearchQuery],
  );
  const memoSearchIndex = useMemo(
    () =>
      snapshot.memos.map((memo) => ({
        haystack: buildSearchHaystack([memo.title, memo.body]),
        memo,
      })),
    [snapshot.memos],
  );
  const filteredMemos = useMemo(
    () =>
      sortMemos(
        memoSearchTokens.length === 0
          ? snapshot.memos
          : memoSearchIndex
              .filter(({ haystack }) => matchesSearchTokens(memoSearchTokens, haystack))
              .map(({ memo }) => memo),
        memoSort,
      ),
    [memoSearchIndex, memoSearchTokens, memoSort, snapshot.memos],
  );

  const { autoSaveLabel, flushPendingMemo, saveMemo } = useMemoAutoSave({
    initialAutoSaveState: initialMemoState.autoSaveState,
    memoForm,
    memoFormRef,
    onClearError,
    onError,
    onNotice,
    onSnapshotChange,
    selectedMemoId,
    setMemoForm,
    setSelectedMemoId,
    snapshot,
    snapshotRef,
  });

  const hydrateMemoState = useCallback(
    (nextSnapshot: StoreSnapshot, preferredMemoId: string | null = null) => {
      const nextState = buildMemoEditingState(nextSnapshot, preferredMemoId);
      setSelectedMemoId(nextState.selectedMemoId);
      setMemoForm(nextState.memoForm);
    },
    [],
  );

  const selectMemo = useCallback(
    (memoId: string) => {
      if (selectedMemoIdRef.current !== memoId) {
        flushPendingMemo();
      }

      const memo = snapshot.memos.find((item) => item.id === memoId);
      if (!memo) {
        return;
      }

      setSelectedMemoId(memoId);
      setMemoForm(toMemoInput(memo));
      onViewChange("memo");
    },
    [flushPendingMemo, onViewChange, snapshot.memos],
  );

  const createMemo = useCallback(() => {
    flushPendingMemo();
    setSelectedMemoId(null);
    setMemoForm(createEmptyMemo());
    onViewChange("memo");
    onNotice("新しいメモを作成しています。");
  }, [flushPendingMemo, onNotice, onViewChange]);

  function changeMemo<K extends keyof MemoInput>(field: K, value: MemoInput[K]) {
    setMemoForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function deleteMemo() {
    if (!selectedMemoId) {
      setMemoForm(createEmptyMemo());
      onNotice("編集中のメモをリセットしました。");
      return;
    }

    try {
      onClearError();
      const deletedMemo = await maildraftApi.deleteMemo(selectedMemoId);
      const nextSnapshot = applyDeletedMemoResult(snapshotRef.current, deletedMemo);
      onSnapshotChange(nextSnapshot);
      hydrateMemoState(nextSnapshot);
      onNotice("メモを削除しました。");
    } catch (deleteError) {
      onError(toMemoWorkspaceErrorMessage(deleteError));
    }
  }

  const selectedMemoUpdatedAt =
    snapshot.memos.find((memo) => memo.id === selectedMemoId)?.updatedAt ?? null;

  return {
    createMemo,
    flushPendingMemo,
    hydrateMemoState,
    saveMemo,
    memoWorkspaceProps: {
      activeMemoUpdatedAt: selectedMemoUpdatedAt,
      autoSaveLabel,
      availableSortOptions: MEMO_SORT_OPTIONS,
      memos: filteredMemos,
      memoForm,
      onChangeMemo: changeMemo,
      onChangeSearchQuery: setMemoSearchQuery,
      onChangeSort: setMemoSort,
      onCreateMemo: createMemo,
      onDeleteMemo: deleteMemo,
      onSaveMemo: saveMemo,
      onSelectMemo: selectMemo,
      searchQuery: memoSearchQuery,
      selectedMemoId,
      showWhitespace: false,
      sort: memoSort,
      totalMemoCount: snapshot.memos.length,
    },
  };
}

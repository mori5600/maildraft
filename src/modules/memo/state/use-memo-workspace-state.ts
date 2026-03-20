import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { MEMO_SORT_OPTIONS, type MemoSortOption } from "../../../shared/lib/list-sort";
import {
  applyDeletedMemoResult,
  getDefaultSignatureId,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { createDraftFromMemoInput, type DraftInput } from "../../drafts/model";
import { buildTrashItemKey } from "../../trash/model";
import {
  createEmptyMemo,
  memoHasMeaningfulContent,
  type MemoInput,
  toMemoInput,
} from "../model";
import {
  buildMemoEditingState,
  createInitialMemoState,
  filterMemos,
  findMemo,
  getMemoUpdatedAt,
  toMemoWorkspaceErrorMessage,
} from "./memo-workspace-helpers";
import { useMemoAutoSave } from "./use-memo-auto-save";

export interface MemoWorkspaceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onOpenDraftInput: (input: DraftInput) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  onTrashItemSelect?: (key: string | null) => void;
  onViewChange: (view: WorkspaceView) => void;
  snapshot: StoreSnapshot;
}

export function useMemoWorkspaceState({
  onClearError,
  onError,
  onNotice,
  onOpenDraftInput,
  onSnapshotChange,
  onTrashItemSelect = () => {},
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

  const filteredMemos = useMemo(
    () => filterMemos(snapshot.memos, deferredMemoSearchQuery, memoSort),
    [deferredMemoSearchQuery, memoSort, snapshot.memos],
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

      const memo = findMemo(snapshotRef.current, memoId);
      if (!memo) {
        return;
      }

      setSelectedMemoId(memoId);
      setMemoForm(toMemoInput(memo));
      onViewChange("memo");
    },
    [flushPendingMemo, onViewChange, snapshotRef],
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

  const startDraftFromMemo = useCallback(() => {
    const currentMemo = memoFormRef.current;

    if (!memoHasMeaningfulContent(currentMemo)) {
      return;
    }

    flushPendingMemo();
    onOpenDraftInput(createDraftFromMemoInput(currentMemo, getDefaultSignatureId(snapshotRef.current)));
    onViewChange("drafts");
    onNotice("メモから新しい下書きを起こしました。");
  }, [flushPendingMemo, onNotice, onOpenDraftInput, onViewChange]);

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
      onTrashItemSelect(buildTrashItemKey("memo", selectedMemoId));
      onNotice("メモをゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toMemoWorkspaceErrorMessage(deleteError));
    }
  }

  const selectedMemoUpdatedAt = getMemoUpdatedAt(snapshot.memos, selectedMemoId);

  return {
    createMemo,
    flushPendingMemo,
    hydrateMemoState,
    saveMemo,
    memoWorkspaceProps: {
      activeMemoUpdatedAt: selectedMemoUpdatedAt,
      autoSaveLabel,
      availableSortOptions: MEMO_SORT_OPTIONS,
      canStartDraftFromMemo: memoHasMeaningfulContent(memoForm),
      memos: filteredMemos,
      memoForm,
      onChangeMemo: changeMemo,
      onChangeSearchQuery: setMemoSearchQuery,
      onChangeSort: setMemoSort,
      onCreateMemo: createMemo,
      onDeleteMemo: deleteMemo,
      onSaveMemo: saveMemo,
      onSelectMemo: selectMemo,
      onStartDraftFromMemo: startDraftFromMemo,
      searchQuery: memoSearchQuery,
      selectedMemoId,
      showWhitespace: false,
      sort: memoSort,
      totalMemoCount: snapshot.memos.length,
    },
  };
}

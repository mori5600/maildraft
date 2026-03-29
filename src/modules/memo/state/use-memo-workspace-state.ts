import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { MEMO_SORT_OPTIONS, type MemoSortOption } from "../../../shared/lib/list-sort";
import {
  applyDeletedMemoResult,
  applySavedMemoResult,
  getDefaultSignatureId,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { createDraftFromMemoInput, type DraftInput } from "../../drafts/model";
import { buildTrashItemKey } from "../../trash/model";
import { createEmptyMemo, memoHasDraftContent, type MemoInput, toMemoInput } from "../model";
import {
  buildMemoEditingState,
  createInitialMemoState,
  findMemo,
  toMemoWorkspaceErrorMessage,
} from "./memo-workspace-helpers";
import { useMemoAutoSave } from "./use-memo-auto-save";
import { useMemoWorkspaceDerivations } from "./use-memo-workspace-derivations";

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
  const [memoTagFilterState, setMemoTagFilter] = useState<string | null>(null);
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
  const {
    activeMemoTagFilter,
    availableMemoTagCounts,
    availableMemoTags,
    canStartDraftFromMemo,
    filteredMemos,
    selectedMemoUpdatedAt,
  } = useMemoWorkspaceDerivations({
    deferredMemoSearchQuery,
    memoForm,
    memoSort,
    requestedTagFilter: memoTagFilterState,
    selectedMemoId,
    snapshot,
  });

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

  function resolveMemoInput(targetMemoId?: string): MemoInput | null {
    const currentSelectedId = selectedMemoIdRef.current;
    if (!targetMemoId || targetMemoId === currentSelectedId) {
      return memoFormRef.current;
    }

    const targetMemo = findMemo(snapshotRef.current, targetMemoId);
    return targetMemo ? toMemoInput(targetMemo) : null;
  }

  async function toggleMemoPinned(targetMemoId?: string) {
    const currentSelectedId = selectedMemoIdRef.current;

    if (!targetMemoId || targetMemoId === currentSelectedId) {
      setMemoForm((current) => ({
        ...current,
        isPinned: !current.isPinned,
      }));
      return;
    }

    const targetMemo = findMemo(snapshotRef.current, targetMemoId);
    if (!targetMemo) {
      return;
    }

    try {
      onClearError();
      const savedMemo = await maildraftApi.saveMemo({
        ...toMemoInput(targetMemo),
        isPinned: !targetMemo.isPinned,
      });
      const nextSnapshot = applySavedMemoResult(snapshotRef.current, savedMemo);
      onSnapshotChange(nextSnapshot);
      onNotice(savedMemo.isPinned ? "メモを固定しました。" : "メモの固定を外しました。");
    } catch (toggleError) {
      onError(toMemoWorkspaceErrorMessage(toggleError));
    }
  }

  const startDraftFromMemo = useCallback(
    (targetMemoId?: string) => {
      const currentMemo = resolveMemoInput(targetMemoId);

      if (!currentMemo || !memoHasDraftContent(currentMemo)) {
        return;
      }

      if (!targetMemoId || targetMemoId === selectedMemoIdRef.current) {
        flushPendingMemo();
      }

      onOpenDraftInput(
        createDraftFromMemoInput(currentMemo, getDefaultSignatureId(snapshotRef.current)),
      );
      onViewChange("drafts");
      onNotice("メモから新しい下書きを起こしました。");
    },
    [flushPendingMemo, onNotice, onOpenDraftInput, onViewChange],
  );

  async function deleteMemo(targetMemoId?: string) {
    const currentSelectedId = selectedMemoIdRef.current;
    const nextTargetId = targetMemoId ?? currentSelectedId;

    if (!nextTargetId) {
      setMemoForm(createEmptyMemo());
      onNotice("編集中のメモをリセットしました。");
      return;
    }

    try {
      onClearError();
      const deletedMemo = await maildraftApi.deleteMemo(nextTargetId);
      const nextSnapshot = applyDeletedMemoResult(snapshotRef.current, deletedMemo);
      onSnapshotChange(nextSnapshot);

      if (nextTargetId === currentSelectedId) {
        hydrateMemoState(nextSnapshot);
      }

      onTrashItemSelect(buildTrashItemKey("memo", nextTargetId));
      onNotice("メモをゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toMemoWorkspaceErrorMessage(deleteError));
    }
  }

  return {
    createMemo,
    flushPendingMemo,
    hydrateMemoState,
    saveMemo,
    toggleMemoPinned,
    memoWorkspaceProps: {
      activeTagFilter: activeMemoTagFilter,
      activeMemoUpdatedAt: selectedMemoUpdatedAt,
      autoSaveLabel,
      availableTags: availableMemoTags,
      tagCounts: availableMemoTagCounts,
      availableSortOptions: MEMO_SORT_OPTIONS,
      canStartDraftFromMemo,
      memos: filteredMemos,
      memoForm,
      onChangeMemo: changeMemo,
      onChangeSearchQuery: setMemoSearchQuery,
      onChangeSort: setMemoSort,
      onChangeTagFilter: setMemoTagFilter,
      onCreateMemo: createMemo,
      onDeleteMemo: deleteMemo,
      onSaveMemo: saveMemo,
      onSelectMemo: selectMemo,
      onTogglePinned: toggleMemoPinned,
      onStartDraftFromMemo: startDraftFromMemo,
      searchQuery: memoSearchQuery,
      selectedMemoId,
      showWhitespace: false,
      sort: memoSort,
      totalMemoCount: snapshot.memos.length,
    },
  };
}

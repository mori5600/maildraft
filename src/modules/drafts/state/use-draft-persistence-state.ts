import { useCallback, useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  applyDeletedDraftResult,
  applySavedDraftResult,
  getDefaultSignatureId,
  pickDraftInput,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import { createEmptyDraft, type DraftInput, duplicateDraftInput, toDraftInput } from "../model";
import { createInitialDraftState, toDraftWorkspaceErrorMessage } from "./draft-workspace-helpers";
import { useDraftAutoSave } from "./use-draft-auto-save";

interface DraftPersistenceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onResetVariablePresetSelection: () => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  snapshot: StoreSnapshot;
}

/**
 * Owns draft selection, draft form state, and draft persistence side effects.
 *
 * @remarks
 * This hook is the write boundary for draft save, delete, duplicate, history restore, and
 * autosave. Compact backend payloads are patched into the current snapshot instead of forcing a
 * full reload. Full snapshot replacement still rehydrates the selected draft and autosave state.
 */
export function useDraftPersistenceState({
  onClearError,
  onError,
  onNotice,
  onResetVariablePresetSelection,
  onSnapshotChange,
  snapshot,
}: DraftPersistenceStateOptions) {
  const initialDraftStateRef = useRef(createInitialDraftState(snapshot));
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(
    initialDraftStateRef.current.selectedDraftId,
  );
  const [draftForm, setDraftForm] = useState<DraftInput>(initialDraftStateRef.current.draftForm);

  const draftFormRef = useRef(draftForm);
  const selectedDraftIdRef = useRef(selectedDraftId);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    draftFormRef.current = draftForm;
  }, [draftForm]);

  useEffect(() => {
    selectedDraftIdRef.current = selectedDraftId;
  }, [selectedDraftId]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const { draftAutoSaveState, flushPendingDraft, saveDraft, setDraftAutoSaveState } =
    useDraftAutoSave({
      draftForm,
      draftFormRef,
      initialAutoSaveState: initialDraftStateRef.current.autoSaveState,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      selectedDraftId,
      setDraftForm,
      setSelectedDraftId,
      snapshot,
      snapshotRef,
    });

  const hydrateSnapshot = useCallback(
    (nextSnapshot: StoreSnapshot) => {
      const initial = createInitialDraftState(nextSnapshot);

      setSelectedDraftId(initial.selectedDraftId);
      setDraftForm(initial.draftForm);
      setDraftAutoSaveState(initial.autoSaveState);
      onResetVariablePresetSelection();
    },
    [onResetVariablePresetSelection, setDraftAutoSaveState],
  );

  const openDraftById = useCallback(
    (draftId: string, sourceSnapshot = snapshotRef.current) => {
      const draft = sourceSnapshot.drafts.find((item) => item.id === draftId);
      if (!draft) {
        return;
      }

      setSelectedDraftId(draftId);
      setDraftForm(toDraftInput(draft));
      setDraftAutoSaveState("saved");
      onResetVariablePresetSelection();
    },
    [onResetVariablePresetSelection, setDraftAutoSaveState],
  );

  const openDraftInput = useCallback(
    (input: DraftInput) => {
      setSelectedDraftId(null);
      setDraftForm(input);
      setDraftAutoSaveState("idle");
      onResetVariablePresetSelection();
    },
    [onResetVariablePresetSelection, setDraftAutoSaveState],
  );

  useEffect(() => {
    if (!selectedDraftId) {
      return;
    }

    if (snapshot.drafts.some((draft) => draft.id === selectedDraftId)) {
      return;
    }

    const initial = createInitialDraftState(snapshot);
    setSelectedDraftId(initial.selectedDraftId);
    setDraftForm(initial.draftForm);
    setDraftAutoSaveState(initial.autoSaveState);
    onResetVariablePresetSelection();
  }, [onResetVariablePresetSelection, selectedDraftId, setDraftAutoSaveState, snapshot]);

  const createDraft = useCallback(() => {
    flushPendingDraft();
    openDraftInput(createEmptyDraft(getDefaultSignatureId(snapshotRef.current)));
    onNotice("新しい下書きを作成しています。");
  }, [flushPendingDraft, onNotice, openDraftInput, snapshotRef]);

  const selectDraft = useCallback(
    (id: string) => {
      if (selectedDraftIdRef.current !== id) {
        flushPendingDraft();
      }

      openDraftById(id);
    },
    [flushPendingDraft, openDraftById],
  );

  function resolveDraftInput(targetDraftId?: string): DraftInput | null {
    const currentSelectedId = selectedDraftIdRef.current;
    if (!targetDraftId || targetDraftId === currentSelectedId) {
      return draftFormRef.current;
    }

    const targetDraft = snapshotRef.current.drafts.find((draft) => draft.id === targetDraftId);
    return targetDraft ? toDraftInput(targetDraft) : null;
  }

  const toggleDraftPinned = useCallback(
    async (targetDraftId?: string) => {
      const currentSelectedId = selectedDraftIdRef.current;

      if (!targetDraftId || targetDraftId === currentSelectedId) {
        setDraftForm((current) => ({
          ...current,
          isPinned: !current.isPinned,
        }));
        return;
      }

      const targetDraft = snapshotRef.current.drafts.find((draft) => draft.id === targetDraftId);
      if (!targetDraft) {
        return;
      }

      try {
        onClearError();
        const savedDraft = await maildraftApi.saveDraft({
          ...toDraftInput(targetDraft),
          isPinned: !targetDraft.isPinned,
        });
        const nextSnapshot = applySavedDraftResult(snapshotRef.current, savedDraft);
        onSnapshotChange(nextSnapshot);
        onNotice(
          savedDraft.draft.isPinned ? "下書きを固定しました。" : "下書きの固定を外しました。",
        );
      } catch (toggleError) {
        onError(toDraftWorkspaceErrorMessage(toggleError));
      }
    },
    [onClearError, onError, onNotice, onSnapshotChange],
  );

  const duplicateDraft = useCallback(
    async (targetDraftId?: string) => {
      const currentSelectedId = selectedDraftIdRef.current;
      if (!targetDraftId && !currentSelectedId) {
        return;
      }

      const sourceDraft = resolveDraftInput(targetDraftId);
      if (!sourceDraft) {
        return;
      }

      const duplicate = duplicateDraftInput(sourceDraft);

      try {
        onClearError();
        const savedDraft = await maildraftApi.saveDraft(duplicate);
        const nextSnapshot = applySavedDraftResult(snapshotRef.current, savedDraft);
        onSnapshotChange(nextSnapshot);

        if (!targetDraftId || targetDraftId === currentSelectedId) {
          setSelectedDraftId(savedDraft.draft.id);
          setDraftForm(toDraftInput(savedDraft.draft));
          setDraftAutoSaveState("saved");
        }

        onNotice("下書きを複製しました。");
      } catch (duplicateError) {
        onError(toDraftWorkspaceErrorMessage(duplicateError));
      }
    },
    [onClearError, onError, onNotice, onSnapshotChange, setDraftAutoSaveState],
  );

  const deleteDraft = useCallback(
    async (targetDraftId?: string) => {
      const currentSelectedId = selectedDraftIdRef.current;
      const nextTargetId = targetDraftId ?? currentSelectedId;

      if (!nextTargetId) {
        createDraft();
        return;
      }

      try {
        onClearError();
        const deletedDraft = await maildraftApi.deleteDraft(nextTargetId);
        const nextSnapshot = applyDeletedDraftResult(snapshotRef.current, deletedDraft);
        onSnapshotChange(nextSnapshot);

        if (nextTargetId === currentSelectedId) {
          const nextSelectedId = nextSnapshot.drafts[0]?.id ?? null;
          setSelectedDraftId(nextSelectedId);
          setDraftForm(pickDraftInput(nextSnapshot, nextSelectedId));
          setDraftAutoSaveState(nextSelectedId ? "saved" : "idle");
        }

        onNotice("下書きをゴミ箱に移動しました。");
      } catch (deleteError) {
        onError(toDraftWorkspaceErrorMessage(deleteError));
      }
    },
    [createDraft, onClearError, onError, onNotice, onSnapshotChange, setDraftAutoSaveState],
  );

  const restoreDraftHistory = useCallback(
    async (historyId: string) => {
      const draftId = selectedDraftId ?? draftForm.id;

      try {
        onClearError();
        const restoredDraft = await maildraftApi.restoreDraftHistory(draftId, historyId);
        const nextSnapshot = applySavedDraftResult(snapshotRef.current, restoredDraft);
        onSnapshotChange(nextSnapshot);
        setSelectedDraftId(draftId);
        setDraftForm(pickDraftInput(nextSnapshot, draftId));
        setDraftAutoSaveState("saved");
        onNotice("履歴から下書きを復元しました。");
      } catch (restoreError) {
        onError(toDraftWorkspaceErrorMessage(restoreError));
      }
    },
    [
      draftForm.id,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      selectedDraftId,
      setDraftAutoSaveState,
    ],
  );

  return {
    createDraft,
    deleteDraft,
    draftAutoSaveState,
    draftForm,
    duplicateDraft,
    flushPendingDraft,
    hydrateSnapshot,
    openDraftById,
    openDraftInput,
    restoreDraftHistory,
    saveDraft,
    selectDraft,
    selectedDraftId,
    setDraftForm,
    toggleDraftPinned,
  };
}

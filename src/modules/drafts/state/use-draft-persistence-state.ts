import { useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { getDefaultSignatureId, pickDraftInput } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import { createEmptyDraft, type DraftInput, duplicateDraftInput, toDraftInput } from "../model";
import {
  createInitialDraftState,
  toDraftWorkspaceErrorMessage,
} from "./draft-workspace-helpers";
import { useDraftAutoSave } from "./use-draft-auto-save";

interface DraftPersistenceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onResetVariablePresetSelection: () => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  snapshot: StoreSnapshot;
}

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

  function hydrateSnapshot(nextSnapshot: StoreSnapshot) {
    const initial = createInitialDraftState(nextSnapshot);

    setSelectedDraftId(initial.selectedDraftId);
    setDraftForm(initial.draftForm);
    setDraftAutoSaveState(initial.autoSaveState);
    onResetVariablePresetSelection();
  }

  function openDraftById(draftId: string, sourceSnapshot = snapshotRef.current) {
    const draft = sourceSnapshot.drafts.find((item) => item.id === draftId);
    if (!draft) {
      return;
    }

    setSelectedDraftId(draftId);
    setDraftForm(toDraftInput(draft));
    setDraftAutoSaveState("saved");
    onResetVariablePresetSelection();
  }

  function openDraftInput(input: DraftInput) {
    setSelectedDraftId(null);
    setDraftForm(input);
    setDraftAutoSaveState("idle");
    onResetVariablePresetSelection();
  }

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

  function createDraft() {
    flushPendingDraft();
    openDraftInput(createEmptyDraft(getDefaultSignatureId(snapshotRef.current)));
    onNotice("新しい下書きを作成しています。");
  }

  function selectDraft(id: string) {
    if (selectedDraftIdRef.current !== id) {
      flushPendingDraft();
    }

    openDraftById(id);
  }

  function toggleDraftPinned() {
    setDraftForm((current) => ({
      ...current,
      isPinned: !current.isPinned,
    }));
  }

  async function duplicateDraft() {
    if (!selectedDraftId) {
      return;
    }

    const duplicate = duplicateDraftInput(draftForm);

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.saveDraft(duplicate);
      onSnapshotChange(nextSnapshot);
      setSelectedDraftId(duplicate.id);
      setDraftForm(pickDraftInput(nextSnapshot, duplicate.id));
      setDraftAutoSaveState("saved");
      onNotice("下書きを複製しました。");
    } catch (duplicateError) {
      onError(toDraftWorkspaceErrorMessage(duplicateError));
    }
  }

  async function deleteDraft() {
    if (!selectedDraftId) {
      createDraft();
      return;
    }

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.deleteDraft(selectedDraftId);
      onSnapshotChange(nextSnapshot);
      const nextSelectedId = nextSnapshot.drafts[0]?.id ?? null;
      setSelectedDraftId(nextSelectedId);
      setDraftForm(pickDraftInput(nextSnapshot, nextSelectedId));
      setDraftAutoSaveState(nextSelectedId ? "saved" : "idle");
      onNotice("下書きをゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toDraftWorkspaceErrorMessage(deleteError));
    }
  }

  async function restoreDraftHistory(historyId: string) {
    const draftId = selectedDraftId ?? draftForm.id;

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.restoreDraftHistory(draftId, historyId);
      onSnapshotChange(nextSnapshot);
      setSelectedDraftId(draftId);
      setDraftForm(pickDraftInput(nextSnapshot, draftId));
      setDraftAutoSaveState("saved");
      onNotice("履歴から下書きを復元しました。");
    } catch (restoreError) {
      onError(toDraftWorkspaceErrorMessage(restoreError));
    }
  }

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

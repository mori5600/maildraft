import { useCallback, useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { getDefaultSignatureId, pickDraftInput } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createEmptyDraft,
  draftHasMeaningfulContent,
  type DraftInput,
  draftInputsEqual,
  duplicateDraftInput,
  toDraftInput,
} from "../model";
import {
  createInitialDraftState,
  type DraftAutoSaveState,
  shouldAutoPersistDraft,
  toDraftWorkspaceErrorMessage,
} from "./draft-workspace-helpers";

const AUTO_SAVE_DELAY_MS = 900;

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
  const [draftAutoSaveState, setDraftAutoSaveState] = useState<DraftAutoSaveState>(
    initialDraftStateRef.current.autoSaveState,
  );

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

  const persistDraft = useCallback(
    async ({ input, mode }: { input: DraftInput; mode: "manual" | "auto" }) => {
      const affectsCurrentDraft = draftFormRef.current.id === input.id;

      if (mode === "auto" && !shouldAutoPersistDraft(input, snapshotRef.current)) {
        return;
      }

      try {
        if (mode === "auto" && affectsCurrentDraft) {
          setDraftAutoSaveState("saving");
        }

        if (mode === "manual") {
          onClearError();
        }

        const nextSnapshot = await maildraftApi.saveDraft(input);
        onSnapshotChange(nextSnapshot);

        if (draftFormRef.current.id === input.id) {
          setSelectedDraftId(input.id);
          setDraftForm(pickDraftInput(nextSnapshot, input.id));
        }

        if (mode === "manual") {
          setDraftAutoSaveState("saved");
          onNotice("下書きを保存しました。");
        } else if (affectsCurrentDraft) {
          setDraftAutoSaveState("saved");
        }
      } catch (saveError) {
        if (affectsCurrentDraft) {
          setDraftAutoSaveState("error");
        }
        onError(toDraftWorkspaceErrorMessage(saveError));
      }
    },
    [onClearError, onError, onNotice, onSnapshotChange],
  );

  const persistedDraft = snapshot.drafts.find((draft) => draft.id === draftForm.id) ?? null;
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;
  const draftShouldPersist = selectedDraftId !== null || draftHasMeaningfulContent(draftForm);
  const draftIsDirty = draftShouldPersist && !draftInputsEqual(draftForm, persistedDraftInput);

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
  }, [onResetVariablePresetSelection, selectedDraftId, snapshot]);

  useEffect(() => {
    if (!draftShouldPersist) {
      setDraftAutoSaveState("idle");
      return;
    }

    if (!draftIsDirty) {
      setDraftAutoSaveState((current) => (current === "error" ? current : "saved"));
      return;
    }

    setDraftAutoSaveState("dirty");

    const timeout = window.setTimeout(() => {
      void persistDraft({
        input: draftForm,
        mode: "auto",
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [draftForm, draftIsDirty, draftShouldPersist, persistDraft]);

  function flushPendingDraft() {
    if (!shouldAutoPersistDraft(draftFormRef.current, snapshotRef.current)) {
      return;
    }

    void persistDraft({
      input: draftFormRef.current,
      mode: "auto",
    });
  }

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

  async function saveDraft() {
    await persistDraft({
      input: draftForm,
      mode: "manual",
    });
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

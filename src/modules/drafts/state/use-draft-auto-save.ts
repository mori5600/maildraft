import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { pickDraftInput } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  draftHasMeaningfulContent,
  type DraftInput,
  draftInputsEqual,
  toDraftInput,
} from "../model";
import {
  type DraftAutoSaveState,
  shouldAutoPersistDraft,
  toDraftWorkspaceErrorMessage,
} from "./draft-workspace-helpers";

const AUTO_SAVE_DELAY_MS = 900;

interface DraftAutoSaveOptions {
  draftForm: DraftInput;
  draftFormRef: RefObject<DraftInput>;
  initialAutoSaveState: DraftAutoSaveState;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  selectedDraftId: string | null;
  setDraftForm: Dispatch<SetStateAction<DraftInput>>;
  setSelectedDraftId: Dispatch<SetStateAction<string | null>>;
  snapshot: StoreSnapshot;
  snapshotRef: RefObject<StoreSnapshot>;
}

interface TransientDraftAutoSaveState {
  draftRevision: string;
  kind: "error" | "saving";
}

export function useDraftAutoSave({
  draftForm,
  draftFormRef,
  initialAutoSaveState,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
  selectedDraftId,
  setDraftForm,
  setSelectedDraftId,
  snapshot,
  snapshotRef,
}: DraftAutoSaveOptions) {
  const initialDraftRevision = serializeDraftRevision(draftForm);
  const [transientDraftAutoSaveState, setTransientDraftAutoSaveState] = useState<
    TransientDraftAutoSaveState | null
  >(
    initialAutoSaveState === "error" || initialAutoSaveState === "saving"
      ? {
          draftRevision: initialDraftRevision,
          kind: initialAutoSaveState,
        }
      : null,
  );

  const persistDraft = useCallback(
    async ({ input, mode }: { input: DraftInput; mode: "manual" | "auto" }) => {
      const affectsCurrentDraft = draftFormRef.current.id === input.id;

      if (mode === "auto" && !shouldAutoPersistDraft(input, snapshotRef.current)) {
        return;
      }

      try {
        if (mode === "auto" && affectsCurrentDraft) {
          setTransientDraftAutoSaveState({
            draftRevision: serializeDraftRevision(input),
            kind: "saving",
          });
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
          setTransientDraftAutoSaveState(null);
          onNotice("下書きを保存しました。");
        } else if (affectsCurrentDraft) {
          setTransientDraftAutoSaveState(null);
        }
      } catch (saveError) {
        if (affectsCurrentDraft) {
          setTransientDraftAutoSaveState({
            draftRevision: serializeDraftRevision(input),
            kind: "error",
          });
        }
        onError(toDraftWorkspaceErrorMessage(saveError));
      }
    },
    [
      draftFormRef,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      setDraftForm,
      setSelectedDraftId,
      snapshotRef,
    ],
  );

  const persistedDraft = snapshot.drafts.find((draft) => draft.id === draftForm.id) ?? null;
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;
  const draftShouldPersist = selectedDraftId !== null || draftHasMeaningfulContent(draftForm);
  const draftIsDirty = draftShouldPersist && !draftInputsEqual(draftForm, persistedDraftInput);
  const draftRevision = serializeDraftRevision(draftForm);
  const baseDraftAutoSaveState: DraftAutoSaveState = !draftShouldPersist
    ? "idle"
    : draftIsDirty
      ? "dirty"
      : "saved";
  const draftAutoSaveState =
    transientDraftAutoSaveState?.draftRevision === draftRevision
      ? transientDraftAutoSaveState.kind
      : baseDraftAutoSaveState;

  useEffect(() => {
    if (!draftShouldPersist || !draftIsDirty) {
      return;
    }

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

  function setDraftAutoSaveState(nextState: DraftAutoSaveState) {
    if (nextState === "error" || nextState === "saving") {
      setTransientDraftAutoSaveState({
        draftRevision: serializeDraftRevision(draftFormRef.current),
        kind: nextState,
      });
      return;
    }

    setTransientDraftAutoSaveState(null);
  }

  async function saveDraft() {
    await persistDraft({
      input: draftForm,
      mode: "manual",
    });
  }

  return {
    draftAutoSaveState,
    flushPendingDraft,
    saveDraft,
    setDraftAutoSaveState,
  };
}

function serializeDraftRevision(input: DraftInput): string {
  const variableValues = Object.keys(input.variableValues)
    .sort()
    .map((key) => [key, input.variableValues[key]]);

  return JSON.stringify({
    body: input.body,
    closing: input.closing,
    id: input.id,
    isPinned: input.isPinned,
    opening: input.opening,
    recipient: input.recipient,
    signatureId: input.signatureId,
    subject: input.subject,
    templateId: input.templateId,
    title: input.title,
    variableValues,
  });
}

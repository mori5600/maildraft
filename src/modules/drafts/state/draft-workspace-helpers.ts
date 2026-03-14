import { getDefaultSignatureId } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createEmptyDraft,
  draftHasMeaningfulContent,
  type DraftInput,
  draftInputsEqual,
  toDraftInput,
} from "../model";

export type DraftAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface InitialDraftState {
  autoSaveState: DraftAutoSaveState;
  draftForm: DraftInput;
  selectedDraftId: string | null;
}

export function createInitialDraftState(snapshot: StoreSnapshot): InitialDraftState {
  const firstDraft = snapshot.drafts[0];

  if (!firstDraft) {
    return {
      autoSaveState: "idle",
      draftForm: createEmptyDraft(getDefaultSignatureId(snapshot)),
      selectedDraftId: null,
    };
  }

  return {
    autoSaveState: "saved",
    draftForm: toDraftInput(firstDraft),
    selectedDraftId: firstDraft.id,
  };
}

export function formatDraftAutoSaveState(state: DraftAutoSaveState): string {
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

export function hasMeaningfulDraftContent(
  input: DraftInput,
  snapshot: StoreSnapshot,
): boolean {
  return (
    draftHasMeaningfulContent(input) ||
    input.signatureId !== getDefaultSignatureId(snapshot)
  );
}

export function shouldAutoPersistDraft(input: DraftInput, snapshot: StoreSnapshot): boolean {
  const persistedDraft = snapshot.drafts.find((draft) => draft.id === input.id);
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;

  if (!persistedDraft && !hasMeaningfulDraftContent(input, snapshot)) {
    return false;
  }

  return !draftInputsEqual(input, persistedDraftInput);
}

export function toDraftWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

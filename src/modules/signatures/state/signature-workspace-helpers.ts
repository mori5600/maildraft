import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createEmptySignature,
  type SignatureInput,
  signatureInputsEqual,
  signatureMatchesPersistedSignature,
  toSignatureInput,
} from "../model";

export type SignatureAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface InitialSignatureState {
  autoSaveState: SignatureAutoSaveState;
  selectedSignatureId: string | null;
  signatureForm: SignatureInput;
}

export function createInitialSignatureState(snapshot: StoreSnapshot): InitialSignatureState {
  const firstSignature = snapshot.signatures[0];

  if (!firstSignature) {
    return {
      autoSaveState: "idle",
      selectedSignatureId: null,
      signatureForm: createEmptySignature(true),
    };
  }

  return {
    autoSaveState: "saved",
    selectedSignatureId: firstSignature.id,
    signatureForm: toSignatureInput(firstSignature),
  };
}

export function formatSignatureAutoSaveState(state: SignatureAutoSaveState): string {
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

export function hasMeaningfulSignatureContent(
  input: SignatureInput,
  snapshot: StoreSnapshot,
): boolean {
  const emptySignature = createEmptySignature(snapshot.signatures.length === 0);

  return !signatureInputsEqual(input, {
    ...emptySignature,
    id: input.id,
  });
}

export function shouldAutoPersistSignature(
  input: SignatureInput,
  snapshot: StoreSnapshot,
): boolean {
  const persistedSignature = snapshot.signatures.find((signature) => signature.id === input.id);

  if (!persistedSignature && !hasMeaningfulSignatureContent(input, snapshot)) {
    return false;
  }

  return !signatureMatchesPersistedSignature(input, persistedSignature ?? null);
}

export function toSignatureWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

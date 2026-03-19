import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { applySavedSignatureResult, pickSignatureInput } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import { type SignatureInput, signatureMatchesPersistedSignature } from "../model";
import {
  hasMeaningfulSignatureContent,
  shouldAutoPersistSignature,
  type SignatureAutoSaveState,
  toSignatureWorkspaceErrorMessage,
} from "./signature-workspace-helpers";

const AUTO_SAVE_DELAY_MS = 900;

interface SignatureAutoSaveOptions {
  initialAutoSaveState: SignatureAutoSaveState;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSignatureSnapshotChange: (snapshot: StoreSnapshot) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  selectedSignatureId: string | null;
  setSelectedSignatureId: Dispatch<SetStateAction<string | null>>;
  setSignatureForm: Dispatch<SetStateAction<SignatureInput>>;
  signatureForm: SignatureInput;
  signatureFormRef: RefObject<SignatureInput>;
  snapshot: StoreSnapshot;
  snapshotRef: RefObject<StoreSnapshot>;
}

interface TransientSignatureAutoSaveState {
  kind: "error" | "saving";
  signatureRevision: string;
}

export function useSignatureAutoSave({
  initialAutoSaveState,
  onClearError,
  onError,
  onNotice,
  onSignatureSnapshotChange,
  onSnapshotChange,
  selectedSignatureId,
  setSelectedSignatureId,
  setSignatureForm,
  signatureForm,
  signatureFormRef,
  snapshot,
  snapshotRef,
}: SignatureAutoSaveOptions) {
  const [transientSignatureAutoSaveState, setTransientSignatureAutoSaveState] =
    useState<TransientSignatureAutoSaveState | null>(() =>
      initialAutoSaveState === "error" || initialAutoSaveState === "saving"
        ? {
            kind: initialAutoSaveState,
            signatureRevision: serializeSignatureRevision(signatureForm),
          }
        : null,
    );

  const persistSignature = useCallback(
    async ({ input, mode }: { input: SignatureInput; mode: "manual" | "auto" }) => {
      const affectsCurrentSignature = signatureFormRef.current.id === input.id;

      if (mode === "auto" && !shouldAutoPersistSignature(input, snapshotRef.current)) {
        return;
      }

      try {
        if (mode === "auto" && affectsCurrentSignature) {
          setTransientSignatureAutoSaveState({
            kind: "saving",
            signatureRevision: serializeSignatureRevision(input),
          });
        }

        if (mode === "manual") {
          onClearError();
        }

        const savedSignature = await maildraftApi.saveSignature(input);
        const nextSnapshot = applySavedSignatureResult(snapshotRef.current, savedSignature);
        onSnapshotChange(nextSnapshot);

        if (signatureFormRef.current.id === input.id) {
          setSelectedSignatureId(input.id);
          setSignatureForm(pickSignatureInput(nextSnapshot, input.id));
        }

        onSignatureSnapshotChange(nextSnapshot);

        if (mode === "manual") {
          setTransientSignatureAutoSaveState(null);
          onNotice("署名を保存しました。");
        } else if (affectsCurrentSignature) {
          setTransientSignatureAutoSaveState(null);
        }
      } catch (saveError) {
        if (affectsCurrentSignature) {
          setTransientSignatureAutoSaveState({
            kind: "error",
            signatureRevision: serializeSignatureRevision(input),
          });
        }

        onError(toSignatureWorkspaceErrorMessage(saveError));
      }
    },
    [
      onClearError,
      onError,
      onNotice,
      onSignatureSnapshotChange,
      onSnapshotChange,
      setSelectedSignatureId,
      setSignatureForm,
      signatureFormRef,
      snapshotRef,
    ],
  );

  const persistedSignatureIndex = useMemo(
    () => new Map(snapshot.signatures.map((signature) => [signature.id, signature] as const)),
    [snapshot.signatures],
  );
  const persistedSignature = persistedSignatureIndex.get(signatureForm.id) ?? null;
  const signatureShouldPersist =
    selectedSignatureId !== null || hasMeaningfulSignatureContent(signatureForm, snapshot);
  const signatureIsDirty =
    signatureShouldPersist &&
    !signatureMatchesPersistedSignature(signatureForm, persistedSignature);
  const signatureRevision = useMemo(
    () => serializeSignatureRevision(signatureForm),
    [signatureForm],
  );
  const baseSignatureAutoSaveState: SignatureAutoSaveState = !signatureShouldPersist
    ? "idle"
    : signatureIsDirty
      ? "dirty"
      : "saved";
  const signatureAutoSaveState =
    transientSignatureAutoSaveState?.signatureRevision === signatureRevision
      ? transientSignatureAutoSaveState.kind
      : baseSignatureAutoSaveState;

  useEffect(() => {
    if (!signatureShouldPersist || !signatureIsDirty) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistSignature({
        input: signatureForm,
        mode: "auto",
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [persistSignature, signatureForm, signatureIsDirty, signatureShouldPersist]);

  const flushPendingSignature = useCallback(() => {
    if (!shouldAutoPersistSignature(signatureFormRef.current, snapshotRef.current)) {
      return;
    }

    void persistSignature({
      input: signatureFormRef.current,
      mode: "auto",
    });
  }, [persistSignature, signatureFormRef, snapshotRef]);

  const setSignatureAutoSaveState = useCallback(
    (nextState: SignatureAutoSaveState) => {
      if (nextState === "error" || nextState === "saving") {
        setTransientSignatureAutoSaveState({
          kind: nextState,
          signatureRevision: serializeSignatureRevision(signatureFormRef.current),
        });
        return;
      }

      setTransientSignatureAutoSaveState(null);
    },
    [signatureFormRef],
  );

  const saveSignature = useCallback(async () => {
    await persistSignature({
      input: signatureForm,
      mode: "manual",
    });
  }, [persistSignature, signatureForm]);

  return {
    flushPendingSignature,
    saveSignature,
    setSignatureAutoSaveState,
    signatureAutoSaveState,
  };
}

function serializeSignatureRevision(input: SignatureInput): string {
  return JSON.stringify({
    body: input.body,
    id: input.id,
    isDefault: input.isDefault,
    isPinned: input.isPinned,
    name: input.name,
  });
}

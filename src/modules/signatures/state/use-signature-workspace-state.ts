import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { type SignatureSortOption, sortSignatures } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import {
  applyDeletedSignatureResult,
  applySavedSignatureResult,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { buildTrashItemKey } from "../../trash/model";
import {
  createEmptySignature,
  duplicateSignatureInput,
  type Signature,
  type SignatureInput,
  toSignatureInput,
} from "../model";
import {
  createInitialSignatureState,
  formatSignatureAutoSaveState,
  toSignatureWorkspaceErrorMessage,
} from "./signature-workspace-helpers";
import { useSignatureAutoSave } from "./use-signature-auto-save";

export interface SignatureWorkspaceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onFlushDraft: () => void;
  onNotice: (message: string) => void;
  onSignatureSnapshotChange: (snapshot: StoreSnapshot) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  onTrashItemSelect: (key: string | null) => void;
  onViewChange: (view: WorkspaceView) => void;
  snapshot: StoreSnapshot;
}

interface SignatureSelectionState {
  selectedSignatureId: string | null;
  signatureForm: SignatureInput;
}

function findSignature(snapshot: StoreSnapshot, signatureId: string | null): Signature | null {
  if (!signatureId) {
    return null;
  }

  return snapshot.signatures.find((signature) => signature.id === signatureId) ?? null;
}

/**
 * Resolves the signature that should back the editing form for the current snapshot.
 *
 * @remarks
 * The preferred signature is used only while it remains active. When it disappears, the state
 * falls back to the first active signature or to a new empty form.
 */
export function buildSignatureEditingState(
  snapshot: StoreSnapshot,
  preferredSignatureId: string | null = null,
): SignatureSelectionState {
  const selectedSignature =
    findSignature(snapshot, preferredSignatureId) ?? snapshot.signatures[0] ?? null;

  return {
    selectedSignatureId: selectedSignature?.id ?? null,
    signatureForm: selectedSignature
      ? toSignatureInput(selectedSignature)
      : createEmptySignature(snapshot.signatures.length === 0),
  };
}

/**
 * Coordinates signature selection, editing, and persistence against the current store snapshot.
 *
 * @remarks
 * Selection always falls back to an existing active signature, or to a new empty form when none
 * remain. Save and delete operations may replace the active signature list because default
 * signature consistency can affect more than the edited item. Callers should fan out
 * `onSignatureSnapshotChange` to any workspace that keeps signature IDs in local form state.
 */
export function useSignatureWorkspaceState({
  onClearError,
  onError,
  onFlushDraft,
  onNotice,
  onSignatureSnapshotChange,
  onSnapshotChange,
  onTrashItemSelect,
  onViewChange,
  snapshot,
}: SignatureWorkspaceStateOptions) {
  const [initialSignatureState] = useState(() => createInitialSignatureState(snapshot));
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
    initialSignatureState.selectedSignatureId,
  );
  const [signatureForm, setSignatureForm] = useState<SignatureInput>(
    initialSignatureState.signatureForm,
  );
  const [signatureSearchQuery, setSignatureSearchQuery] = useState("");
  const [signatureSort, setSignatureSort] = useState<SignatureSortOption>("recent");
  const deferredSignatureSearchQuery = useDeferredValue(signatureSearchQuery);
  const signatureFormRef = useRef(signatureForm);
  const selectedSignatureIdRef = useRef(selectedSignatureId);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    signatureFormRef.current = signatureForm;
  }, [signatureForm]);

  useEffect(() => {
    selectedSignatureIdRef.current = selectedSignatureId;
  }, [selectedSignatureId]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  const signatureSearchTokens = useMemo(
    () => createSearchTokens(deferredSignatureSearchQuery),
    [deferredSignatureSearchQuery],
  );
  const signatureSearchIndex = useMemo(
    () =>
      snapshot.signatures.map((signature) => ({
        haystack: buildSearchHaystack([signature.name, signature.body]),
        signature,
      })),
    [snapshot.signatures],
  );

  const filteredSignatures = useMemo(
    () =>
      sortSignatures(
        signatureSearchTokens.length === 0
          ? snapshot.signatures
          : signatureSearchIndex
              .filter(({ haystack }) => matchesSearchTokens(signatureSearchTokens, haystack))
              .map(({ signature }) => signature),
        signatureSort,
      ),
    [signatureSearchIndex, signatureSearchTokens, signatureSort, snapshot.signatures],
  );

  const {
    flushPendingSignature,
    saveSignature,
    setSignatureAutoSaveState,
    signatureAutoSaveState,
  } = useSignatureAutoSave({
    initialAutoSaveState: initialSignatureState.autoSaveState,
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
  });

  function hydrateSignatureState(
    nextSnapshot: StoreSnapshot,
    preferredSignatureId: string | null = null,
  ) {
    const nextState = buildSignatureEditingState(nextSnapshot, preferredSignatureId);
    setSelectedSignatureId(nextState.selectedSignatureId);
    setSignatureForm(nextState.signatureForm);
    setSignatureAutoSaveState(nextState.selectedSignatureId ? "saved" : "idle");
  }

  const selectSignature = useCallback(
    (signatureId: string) => {
      onFlushDraft();
      if (selectedSignatureIdRef.current !== signatureId) {
        flushPendingSignature();
      }

      const signature = findSignature(snapshot, signatureId);
      if (!signature) {
        return;
      }

      setSelectedSignatureId(signatureId);
      setSignatureForm(toSignatureInput(signature));
      setSignatureAutoSaveState("saved");
      onViewChange("signatures");
    },
    [flushPendingSignature, onFlushDraft, onViewChange, setSignatureAutoSaveState, snapshot],
  );

  const createSignature = useCallback(() => {
    onFlushDraft();
    flushPendingSignature();
    setSelectedSignatureId(null);
    setSignatureForm(createEmptySignature(snapshot.signatures.length === 0));
    setSignatureAutoSaveState("idle");
    onViewChange("signatures");
    onNotice("新しい署名を作成しています。");
  }, [
    flushPendingSignature,
    onFlushDraft,
    onNotice,
    onViewChange,
    setSignatureAutoSaveState,
    snapshot.signatures.length,
  ]);

  function changeSignature<K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) {
    setSignatureForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resolveSignatureInput(targetSignatureId?: string): SignatureInput | null {
    const currentSelectedId = selectedSignatureIdRef.current;
    if (!targetSignatureId || targetSignatureId === currentSelectedId) {
      return signatureFormRef.current;
    }

    const targetSignature = findSignature(snapshotRef.current, targetSignatureId);
    return targetSignature ? toSignatureInput(targetSignature) : null;
  }

  async function toggleSignaturePinned(targetSignatureId?: string) {
    const currentSelectedId = selectedSignatureIdRef.current;

    if (!targetSignatureId || targetSignatureId === currentSelectedId) {
      setSignatureForm((current) => ({
        ...current,
        isPinned: !current.isPinned,
      }));
      return;
    }

    const targetSignature = findSignature(snapshotRef.current, targetSignatureId);
    if (!targetSignature) {
      return;
    }

    try {
      onClearError();
      const savedSignature = await maildraftApi.saveSignature({
        ...toSignatureInput(targetSignature),
        isPinned: !targetSignature.isPinned,
      });
      const nextSnapshot = applySavedSignatureResult(snapshotRef.current, savedSignature);
      onSnapshotChange(nextSnapshot);
      onSignatureSnapshotChange(nextSnapshot);
      onNotice(
        nextSnapshot.signatures.find((signature) => signature.id === targetSignatureId)?.isPinned
          ? "署名を固定しました。"
          : "署名の固定を外しました。",
      );
    } catch (toggleError) {
      onError(toSignatureWorkspaceErrorMessage(toggleError));
    }
  }

  async function duplicateSignature(targetSignatureId?: string) {
    const currentSelectedId = selectedSignatureIdRef.current;
    if (!targetSignatureId && !currentSelectedId) {
      return;
    }

    const sourceSignature = resolveSignatureInput(targetSignatureId);
    if (!sourceSignature) {
      return;
    }

    const duplicate = duplicateSignatureInput(sourceSignature);

    try {
      onClearError();
      const savedSignature = await maildraftApi.saveSignature(duplicate);
      const nextSnapshot = applySavedSignatureResult(snapshotRef.current, savedSignature);
      onSnapshotChange(nextSnapshot);

      if (!targetSignatureId || targetSignatureId === currentSelectedId) {
        hydrateSignatureState(nextSnapshot, duplicate.id);
      }

      onSignatureSnapshotChange(nextSnapshot);
      onNotice("署名を複製しました。");
    } catch (duplicateError) {
      onError(toSignatureWorkspaceErrorMessage(duplicateError));
    }
  }

  async function deleteSignature(targetSignatureId?: string) {
    const currentSelectedId = selectedSignatureIdRef.current;
    const nextTargetId = targetSignatureId ?? currentSelectedId;

    if (!nextTargetId) {
      createSignature();
      return;
    }

    try {
      onClearError();
      const deletedSignature = await maildraftApi.deleteSignature(nextTargetId);
      const nextSnapshot = applyDeletedSignatureResult(snapshotRef.current, deletedSignature);
      onSnapshotChange(nextSnapshot);

      if (nextTargetId === currentSelectedId) {
        hydrateSignatureState(nextSnapshot);
      }

      onSignatureSnapshotChange(nextSnapshot);
      onTrashItemSelect(buildTrashItemKey("signature", nextTargetId));
      onNotice("署名をゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toSignatureWorkspaceErrorMessage(deleteError));
    }
  }

  return {
    createSignature,
    flushPendingSignature,
    hydrateSignatureState,
    saveSignature,
    toggleSignaturePinned,
    signatureWorkspaceProps: {
      autoSaveLabel: formatSignatureAutoSaveState(signatureAutoSaveState),
      canDuplicate: selectedSignatureId !== null,
      onChangeSearchQuery: setSignatureSearchQuery,
      onChangeSignature: changeSignature,
      onChangeSort: setSignatureSort,
      onCreateSignature: createSignature,
      onDeleteSignature: deleteSignature,
      onDuplicateSignature: duplicateSignature,
      onSaveSignature: saveSignature,
      onSelectSignature: selectSignature,
      onTogglePinned: toggleSignaturePinned,
      searchQuery: signatureSearchQuery,
      selectedSignatureId,
      showWhitespace: false,
      signatureForm,
      signatures: filteredSignatures,
      sort: signatureSort,
      totalSignatureCount: snapshot.signatures.length,
    },
  };
}

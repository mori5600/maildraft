import { useCallback, useDeferredValue, useMemo, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { type SignatureSortOption, sortSignatures } from "../../../shared/lib/list-sort";
import { matchesSearchQuery } from "../../../shared/lib/search";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { buildTrashItemKey } from "../../trash/model";
import {
  createEmptySignature,
  duplicateSignatureInput,
  type Signature,
  type SignatureInput,
  toSignatureInput,
} from "../model";

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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

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
  const [initialSignatureState] = useState(() => buildSignatureEditingState(snapshot));
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
    initialSignatureState.selectedSignatureId,
  );
  const [signatureForm, setSignatureForm] = useState<SignatureInput>(
    initialSignatureState.signatureForm,
  );
  const [signatureSearchQuery, setSignatureSearchQuery] = useState("");
  const [signatureSort, setSignatureSort] = useState<SignatureSortOption>("recent");
  const deferredSignatureSearchQuery = useDeferredValue(signatureSearchQuery);

  const filteredSignatures = useMemo(
    () =>
      sortSignatures(
        snapshot.signatures.filter((signature) =>
          matchesSearchQuery(deferredSignatureSearchQuery, [signature.name, signature.body]),
        ),
        signatureSort,
      ),
    [deferredSignatureSearchQuery, signatureSort, snapshot.signatures],
  );

  function hydrateSignatureState(
    nextSnapshot: StoreSnapshot,
    preferredSignatureId: string | null = null,
  ) {
    const nextState = buildSignatureEditingState(nextSnapshot, preferredSignatureId);
    setSelectedSignatureId(nextState.selectedSignatureId);
    setSignatureForm(nextState.signatureForm);
  }

  const selectSignature = useCallback((signatureId: string) => {
    onFlushDraft();

    const signature = findSignature(snapshot, signatureId);
    if (!signature) {
      return;
    }

    setSelectedSignatureId(signatureId);
    setSignatureForm(toSignatureInput(signature));
    onViewChange("signatures");
  }, [onFlushDraft, onViewChange, snapshot]);

  const createSignature = useCallback(() => {
    onFlushDraft();
    setSelectedSignatureId(null);
    setSignatureForm(createEmptySignature(snapshot.signatures.length === 0));
    onViewChange("signatures");
    onNotice("新しい署名を作成しています。");
  }, [onFlushDraft, onNotice, onViewChange, snapshot.signatures.length]);

  function changeSignature<K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) {
    setSignatureForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSignaturePinned() {
    setSignatureForm((current) => ({
      ...current,
      isPinned: !current.isPinned,
    }));
  }

  async function saveSignature() {
    try {
      onClearError();
      const nextSnapshot = await maildraftApi.saveSignature(signatureForm);
      onSnapshotChange(nextSnapshot);
      hydrateSignatureState(nextSnapshot, signatureForm.id);
      onSignatureSnapshotChange(nextSnapshot);
      onNotice("署名を保存しました。");
    } catch (saveError) {
      onError(toErrorMessage(saveError));
    }
  }

  async function duplicateSignature() {
    if (!selectedSignatureId) {
      return;
    }

    const duplicate = duplicateSignatureInput(signatureForm);

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.saveSignature(duplicate);
      onSnapshotChange(nextSnapshot);
      hydrateSignatureState(nextSnapshot, duplicate.id);
      onSignatureSnapshotChange(nextSnapshot);
      onNotice("署名を複製しました。");
    } catch (duplicateError) {
      onError(toErrorMessage(duplicateError));
    }
  }

  async function deleteSignature() {
    if (!selectedSignatureId) {
      createSignature();
      return;
    }

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.deleteSignature(selectedSignatureId);
      onSnapshotChange(nextSnapshot);
      hydrateSignatureState(nextSnapshot);
      onSignatureSnapshotChange(nextSnapshot);
      onTrashItemSelect(buildTrashItemKey("signature", selectedSignatureId));
      onNotice("署名をゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toErrorMessage(deleteError));
    }
  }

  return {
    createSignature,
    hydrateSignatureState,
    saveSignature,
    toggleSignaturePinned,
    signatureWorkspaceProps: {
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

import { confirm } from "@tauri-apps/plugin-dialog";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { copyPlainText } from "../../../shared/lib/clipboard";
import { type DraftSortOption, sortDrafts } from "../../../shared/lib/list-sort";
import { matchesSearchQuery } from "../../../shared/lib/search";
import {
  getDefaultSignatureId,
  pickDraftInput,
  pickKnownSignatureId,
  templateExists,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  collectDraftChecks,
  collectDraftVariableNames,
  renderDraftPreview,
  renderDraftSubject,
} from "../../renderer/render-draft";
import { findTrashSignature } from "../../trash/model";
import {
  applyTemplateToDraft,
  createEmptyDraft,
  draftHasMeaningfulContent,
  type DraftInput,
  draftInputsEqual,
  duplicateDraftInput,
  toDraftInput,
} from "../model";
import type { VariablePresetInput } from "../variable-presets";
import {
  applyVariablePresetValues,
  collectMeaningfulVariableValues,
  hasMeaningfulVariableValues,
} from "../variable-presets";

type DraftAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTO_SAVE_DELAY_MS = 900;

export interface DraftWorkspaceHandle {
  flushPendingDraft: () => void;
  createDraft: () => void;
  hydrateSnapshot: (snapshot: StoreSnapshot) => void;
  openDraftById: (draftId: string, snapshot?: StoreSnapshot) => void;
  openDraftInput: (input: DraftInput) => void;
  saveDraft: () => Promise<void>;
  togglePinned: () => void;
  copyPreview: () => Promise<void>;
}

interface DraftWorkspaceStateOptions {
  snapshot: StoreSnapshot;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
}

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

function shouldAutoPersistDraft(input: DraftInput, snapshot: StoreSnapshot): boolean {
  const persistedDraft = snapshot.drafts.find((draft) => draft.id === input.id);
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;

  if (!persistedDraft && !draftHasMeaningfulContent(input)) {
    return false;
  }

  return !draftInputsEqual(input, persistedDraftInput);
}

function formatDraftAutoSaveState(state: DraftAutoSaveState): string {
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

function createInitialDraftState(snapshot: StoreSnapshot): {
  autoSaveState: DraftAutoSaveState;
  draftForm: DraftInput;
  selectedDraftId: string | null;
} {
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

export function useDraftWorkspaceState({
  snapshot,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
}: DraftWorkspaceStateOptions) {
  const initialDraftStateRef = useRef(createInitialDraftState(snapshot));
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(
    initialDraftStateRef.current.selectedDraftId,
  );
  const [draftForm, setDraftForm] = useState<DraftInput>(initialDraftStateRef.current.draftForm);
  const [draftAutoSaveState, setDraftAutoSaveState] = useState<DraftAutoSaveState>(
    initialDraftStateRef.current.autoSaveState,
  );
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSortOption>("recent");
  const [selectedVariablePresetId, setSelectedVariablePresetId] = useState<string | null>(null);
  const [variablePresetName, setVariablePresetName] = useState("");

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

  const deferredDraftForm = useDeferredValue(draftForm);
  const selectedDraftSignature = useMemo(
    () => findTrashSignature(snapshot.signatures, snapshot.trash.signatures, draftForm.signatureId),
    [draftForm.signatureId, snapshot.signatures, snapshot.trash.signatures],
  );
  const deferredDraftSignature = useMemo(
    () =>
      findTrashSignature(
        snapshot.signatures,
        snapshot.trash.signatures,
        deferredDraftForm.signatureId,
      ),
    [deferredDraftForm.signatureId, snapshot.signatures, snapshot.trash.signatures],
  );
  const persistedDraft = useMemo(
    () => snapshot.drafts.find((draft) => draft.id === draftForm.id) ?? null,
    [draftForm.id, snapshot.drafts],
  );
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;
  const draftShouldPersist = selectedDraftId !== null || draftHasMeaningfulContent(draftForm);
  const draftIsDirty = draftShouldPersist && !draftInputsEqual(draftForm, persistedDraftInput);
  const draftVariableNames = useMemo(
    () => collectDraftVariableNames(draftForm, selectedDraftSignature),
    [draftForm, selectedDraftSignature],
  );
  const draftChecks = useMemo(
    () => collectDraftChecks(deferredDraftForm, deferredDraftSignature),
    [deferredDraftForm, deferredDraftSignature],
  );
  const draftPreviewText = useMemo(
    () => renderDraftPreview(deferredDraftForm, deferredDraftSignature),
    [deferredDraftForm, deferredDraftSignature],
  );
  const draftPreviewSubject = useMemo(
    () => renderDraftSubject(deferredDraftForm),
    [deferredDraftForm],
  );
  const selectedVariablePreset = useMemo(
    () => snapshot.variablePresets.find((preset) => preset.id === selectedVariablePresetId) ?? null,
    [selectedVariablePresetId, snapshot.variablePresets],
  );
  const canSaveVariablePreset =
    variablePresetName.trim().length > 0 &&
    hasMeaningfulVariableValues(draftVariableNames, draftForm.variableValues);
  const canApplyVariablePreset =
    selectedVariablePreset !== null &&
    draftVariableNames.some((name) => typeof selectedVariablePreset.values[name] === "string");
  const draftHistory = useMemo(
    () => snapshot.draftHistory.filter((entry) => entry.draftId === draftForm.id),
    [draftForm.id, snapshot.draftHistory],
  );
  const filteredDrafts = useMemo(
    () =>
      sortDrafts(
        snapshot.drafts.filter((draft) =>
          matchesSearchQuery(draftSearchQuery, [
            draft.title,
            draft.subject,
            draft.recipient,
            draft.opening,
            draft.body,
            draft.closing,
            ...Object.values(draft.variableValues),
          ]),
        ),
        draftSort,
      ),
    [draftSearchQuery, draftSort, snapshot.drafts],
  );

  useEffect(() => {
    setDraftForm((current) => {
      const nextTemplateId = templateExists(snapshot, current.templateId)
        ? current.templateId
        : null;
      const nextSignatureId = pickKnownSignatureId(snapshot, current.signatureId);

      if (nextTemplateId === current.templateId && nextSignatureId === current.signatureId) {
        return current;
      }

      return {
        ...current,
        templateId: nextTemplateId,
        signatureId: nextSignatureId,
      };
    });
  }, [snapshot]);

  useEffect(() => {
    if (
      selectedVariablePresetId !== null &&
      !snapshot.variablePresets.some((preset) => preset.id === selectedVariablePresetId)
    ) {
      setSelectedVariablePresetId(null);
      setVariablePresetName("");
    }
  }, [selectedVariablePresetId, snapshot.variablePresets]);

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
    resetVariablePresetSelection();
  }, [selectedDraftId, snapshot]);

  function resetVariablePresetSelection() {
    setSelectedVariablePresetId(null);
    setVariablePresetName("");
  }

  function hydrateSnapshot(nextSnapshot: StoreSnapshot) {
    const initial = createInitialDraftState(nextSnapshot);

    setSelectedDraftId(initial.selectedDraftId);
    setDraftForm(initial.draftForm);
    setDraftAutoSaveState(initial.autoSaveState);
    resetVariablePresetSelection();
  }

  function openDraftById(draftId: string, sourceSnapshot = snapshotRef.current) {
    const draft = sourceSnapshot.drafts.find((item) => item.id === draftId);
    if (!draft) {
      return;
    }

    setSelectedDraftId(draftId);
    setDraftForm(toDraftInput(draft));
    setDraftAutoSaveState("saved");
    resetVariablePresetSelection();
  }

  function openDraftInput(input: DraftInput) {
    setSelectedDraftId(null);
    setDraftForm(input);
    setDraftAutoSaveState("idle");
    resetVariablePresetSelection();
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
        onError(asMessage(saveError));
      }
    },
    [onClearError, onError, onNotice, onSnapshotChange],
  );

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

  function changeDraft<K extends keyof DraftInput>(field: K, value: DraftInput[K]) {
    setDraftForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleDraftPinned() {
    setDraftForm((current) => ({
      ...current,
      isPinned: !current.isPinned,
    }));
  }

  function changeDraftVariable(name: string, value: string) {
    setDraftForm((current) => ({
      ...current,
      variableValues: {
        ...current.variableValues,
        [name]: value,
      },
    }));
  }

  function selectDraft(id: string) {
    if (selectedDraftIdRef.current !== id) {
      flushPendingDraft();
    }

    openDraftById(id);
  }

  function selectVariablePreset(id: string | null) {
    if (!id) {
      resetVariablePresetSelection();
      return;
    }

    const preset = snapshot.variablePresets.find((item) => item.id === id);
    if (!preset) {
      return;
    }

    setSelectedVariablePresetId(preset.id);
    setVariablePresetName(preset.name);
  }

  function createVariablePreset() {
    resetVariablePresetSelection();
  }

  function changeVariablePresetName(value: string) {
    setVariablePresetName(value);
  }

  function applyVariablePreset() {
    if (!selectedVariablePreset) {
      return;
    }

    setDraftForm((current) => ({
      ...current,
      variableValues: applyVariablePresetValues(
        current.variableValues,
        selectedVariablePreset.values,
        draftVariableNames,
      ),
    }));
    onNotice(`変数値セット「${selectedVariablePreset.name}」を適用しました。`);
  }

  async function saveVariablePreset() {
    if (!canSaveVariablePreset) {
      return;
    }

    const input: VariablePresetInput = {
      id: selectedVariablePresetId ?? crypto.randomUUID(),
      name: variablePresetName.trim(),
      values: collectMeaningfulVariableValues(draftVariableNames, draftForm.variableValues),
    };

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.saveVariablePreset(input);
      onSnapshotChange(nextSnapshot);
      setSelectedVariablePresetId(input.id);
      setVariablePresetName(input.name);
      onNotice(
        selectedVariablePresetId ? "変数値セットを更新しました。" : "変数値セットを保存しました。",
      );
    } catch (saveError) {
      onError(asMessage(saveError));
    }
  }

  async function deleteVariablePreset() {
    if (!selectedVariablePreset) {
      return;
    }

    const confirmed = await confirm(
      `変数値セット「${selectedVariablePreset.name}」を削除します。続けますか？`,
      {
        title: "MailDraft",
        kind: "warning",
        okLabel: "Delete",
        cancelLabel: "Cancel",
      },
    );

    if (!confirmed) {
      return;
    }

    try {
      onClearError();
      const nextSnapshot = await maildraftApi.deleteVariablePreset(selectedVariablePreset.id);
      onSnapshotChange(nextSnapshot);
      resetVariablePresetSelection();
      onNotice("変数値セットを削除しました。");
    } catch (deleteError) {
      onError(asMessage(deleteError));
    }
  }

  function changeDraftSearchQuery(value: string) {
    setDraftSearchQuery(value);
  }

  function changeDraftSort(value: DraftSortOption) {
    setDraftSort(value);
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
      onError(asMessage(duplicateError));
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
      onError(asMessage(deleteError));
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
      onError(asMessage(restoreError));
    }
  }

  async function copyPreview() {
    try {
      onClearError();
      await copyPlainText(renderDraftPreview(draftForm, selectedDraftSignature));
      onNotice("プレーンテキストの本文をコピーしました。");
    } catch (copyError) {
      onError(asMessage(copyError));
    }
  }

  function applyTemplate(templateId: string) {
    const template = snapshot.templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setDraftForm((current) => applyTemplateToDraft(current, template));
    onNotice(`テンプレート「${template.name}」を下書きに反映しました。`);
  }

  return {
    handle: {
      copyPreview,
      createDraft,
      flushPendingDraft,
      hydrateSnapshot,
      openDraftById,
      openDraftInput,
      saveDraft,
      togglePinned: toggleDraftPinned,
    } satisfies DraftWorkspaceHandle,
    workspaceProps: {
      autoSaveLabel: formatDraftAutoSaveState(draftAutoSaveState),
      canApplyVariablePreset,
      canDuplicate: selectedDraftId !== null,
      canSaveVariablePreset,
      checks: draftChecks,
      draftForm,
      draftHistory,
      drafts: filteredDrafts,
      onApplyTemplate: applyTemplate,
      onApplyVariablePreset: applyVariablePreset,
      onChangeDraft: changeDraft,
      onChangeDraftVariable: changeDraftVariable,
      onChangeSearchQuery: changeDraftSearchQuery,
      onChangeSort: changeDraftSort,
      onChangeVariablePresetName: changeVariablePresetName,
      onCopyPreview: copyPreview,
      onCreateDraft: createDraft,
      onCreateVariablePreset: createVariablePreset,
      onDeleteDraft: deleteDraft,
      onDeleteVariablePreset: deleteVariablePreset,
      onDuplicateDraft: duplicateDraft,
      onRestoreDraftHistory: restoreDraftHistory,
      onSaveDraft: saveDraft,
      onSaveVariablePreset: saveVariablePreset,
      onSelectDraft: selectDraft,
      onSelectVariablePreset: selectVariablePreset,
      onTogglePinned: toggleDraftPinned,
      previewSubject: draftPreviewSubject,
      previewText: draftPreviewText,
      searchQuery: draftSearchQuery,
      selectedDraftId,
      selectedVariablePresetId,
      signatures: snapshot.signatures,
      sort: draftSort,
      templates: snapshot.templates,
      totalDraftCount: snapshot.drafts.length,
      variableNames: draftVariableNames,
      variablePresetName,
      variablePresets: snapshot.variablePresets,
    },
  };
}

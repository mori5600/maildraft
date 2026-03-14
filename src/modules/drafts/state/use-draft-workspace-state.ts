import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { copyPlainText } from "../../../shared/lib/clipboard";
import { type DraftSortOption, sortDrafts } from "../../../shared/lib/list-sort";
import { matchesSearchQuery } from "../../../shared/lib/search";
import { pickKnownSignatureId, templateExists } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  collectDraftChecks,
  collectDraftVariableNames,
  renderDraftPreview,
  renderDraftSubject,
} from "../../renderer/render-draft";
import { findTrashSignature } from "../../trash/model";
import { applyTemplateToDraft, type DraftInput } from "../model";
import {
  formatDraftAutoSaveState,
  toDraftWorkspaceErrorMessage,
} from "./draft-workspace-helpers";
import { useDraftPersistenceState } from "./use-draft-persistence-state";
import { useDraftVariablePresetsState } from "./use-draft-variable-presets-state";

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

export function useDraftWorkspaceState({
  snapshot,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
}: DraftWorkspaceStateOptions) {
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSortOption>("recent");

  const persistenceState = useDraftPersistenceState({
    onClearError,
    onError,
    onNotice,
    onResetVariablePresetSelection: () => variablePresetState.resetVariablePresetSelection(),
    onSnapshotChange,
    snapshot,
  });
  const {
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
  } = persistenceState;

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
  const variablePresetState = useDraftVariablePresetsState({
    draftForm,
    draftVariableNames,
    onClearError,
    onError,
    onNotice,
    onSnapshotChange,
    setDraftForm,
    snapshot,
  });

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
  }, [setDraftForm, snapshot]);

  function changeDraft<K extends keyof DraftInput>(field: K, value: DraftInput[K]) {
    setDraftForm((current) => ({
      ...current,
      [field]: value,
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

  function changeDraftSearchQuery(value: string) {
    setDraftSearchQuery(value);
  }

  function changeDraftSort(value: DraftSortOption) {
    setDraftSort(value);
  }

  async function copyPreview() {
    try {
      onClearError();
      await copyPlainText(renderDraftPreview(draftForm, selectedDraftSignature));
      onNotice("プレーンテキストの本文をコピーしました。");
    } catch (copyError) {
      onError(toDraftWorkspaceErrorMessage(copyError));
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
      canApplyVariablePreset: variablePresetState.canApplyVariablePreset,
      canDuplicate: selectedDraftId !== null,
      canSaveVariablePreset: variablePresetState.canSaveVariablePreset,
      checks: draftChecks,
      draftForm,
      draftHistory,
      drafts: filteredDrafts,
      onApplyTemplate: applyTemplate,
      onApplyVariablePreset: variablePresetState.applyVariablePreset,
      onChangeDraft: changeDraft,
      onChangeDraftVariable: changeDraftVariable,
      onChangeSearchQuery: changeDraftSearchQuery,
      onChangeSort: changeDraftSort,
      onChangeVariablePresetName: variablePresetState.changeVariablePresetName,
      onCopyPreview: copyPreview,
      onCreateDraft: createDraft,
      onCreateVariablePreset: variablePresetState.createVariablePreset,
      onDeleteDraft: deleteDraft,
      onDeleteVariablePreset: variablePresetState.deleteVariablePreset,
      onDuplicateDraft: duplicateDraft,
      onRestoreDraftHistory: restoreDraftHistory,
      onSaveDraft: saveDraft,
      onSaveVariablePreset: variablePresetState.saveVariablePreset,
      onSelectDraft: selectDraft,
      onSelectVariablePreset: variablePresetState.selectVariablePreset,
      onTogglePinned: toggleDraftPinned,
      previewSubject: draftPreviewSubject,
      previewText: draftPreviewText,
      searchQuery: draftSearchQuery,
      selectedDraftId,
      selectedVariablePresetId: variablePresetState.selectedVariablePresetId,
      signatures: snapshot.signatures,
      sort: draftSort,
      templates: snapshot.templates,
      totalDraftCount: snapshot.drafts.length,
      variableNames: draftVariableNames,
      variablePresetName: variablePresetState.variablePresetName,
      variablePresets: snapshot.variablePresets,
    },
  };
}

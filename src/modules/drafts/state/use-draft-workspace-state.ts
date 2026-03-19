import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { copyPlainText } from "../../../shared/lib/clipboard";
import { type DraftSortOption, sortDrafts } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import { pickKnownSignatureId, templateExists } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  buildDraftRenderResult,
  collectDraftVariableNames,
  renderDraftPreview,
} from "../../renderer/render-draft";
import { findTrashSignature } from "../../trash/model";
import { applyTemplateToDraft, type DraftInput } from "../model";
import {
  formatDraftAutoSaveState,
  toDraftWorkspaceErrorMessage,
} from "./draft-workspace-helpers";
import { useDraftPersistenceState } from "./use-draft-persistence-state";
import { useDraftVariablePresetsState } from "./use-draft-variable-presets-state";

/**
 * Imperative draft actions exposed to the app shell through `forwardRef`.
 *
 * @remarks
 * The handle is intentionally small. It exists for global navigation and save actions that must
 * reach the current draft state without threading callbacks through unrelated screens.
 */
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

/**
 * Coordinates draft editing, derived preview state, and draft-specific persistence helpers.
 *
 * @remarks
 * The hook keeps draft form references valid when templates or signatures disappear from the
 * active snapshot. Draft save, restore, and variable preset updates all patch compact backend
 * payloads into the current snapshot instead of forcing a full reload.
 */
export function useDraftWorkspaceState({
  snapshot,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
}: DraftWorkspaceStateOptions) {
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSortOption>("recent");
  const deferredDraftSearchQuery = useDeferredValue(draftSearchQuery);

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
  const draftRenderResult = useMemo(
    () => buildDraftRenderResult(deferredDraftForm, deferredDraftSignature),
    [deferredDraftForm, deferredDraftSignature],
  );
  const draftHistory = useMemo(
    () => snapshot.draftHistory.filter((entry) => entry.draftId === draftForm.id),
    [draftForm.id, snapshot.draftHistory],
  );
  const draftSearchTokens = useMemo(
    () => createSearchTokens(deferredDraftSearchQuery),
    [deferredDraftSearchQuery],
  );
  const draftSearchIndex = useMemo(
    () =>
      snapshot.drafts.map((draft) => ({
        draft,
        haystack: buildSearchHaystack([
          draft.title,
          draft.subject,
          draft.recipient,
          draft.opening,
          draft.body,
          draft.closing,
          ...Object.values(draft.variableValues),
        ]),
      })),
    [snapshot.drafts],
  );
  const filteredDrafts = useMemo(
    () =>
      sortDrafts(
        draftSearchTokens.length === 0
          ? snapshot.drafts
          : draftSearchIndex
              .filter(({ haystack }) => matchesSearchTokens(draftSearchTokens, haystack))
              .map(({ draft }) => draft),
        draftSort,
      ),
    [draftSearchIndex, draftSearchTokens, draftSort, snapshot.drafts],
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
      checks: draftRenderResult.checks,
      draftForm,
      draftHistory,
      drafts: filteredDrafts,
      onApplyTemplate: applyTemplate,
      onApplyVariablePreset: variablePresetState.applyVariablePreset,
      onChangeDraft: changeDraft,
      onChangeDraftVariable: changeDraftVariable,
      onChangeSearchQuery: setDraftSearchQuery,
      onChangeSort: setDraftSort,
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
      previewSubject: draftRenderResult.previewSubject,
      previewText: draftRenderResult.previewText,
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

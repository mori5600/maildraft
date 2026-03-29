import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { copyPlainText } from "../../../shared/lib/clipboard";
import type { DraftSortOption } from "../../../shared/lib/list-sort";
import { pickKnownSignatureId, templateExists } from "../../../shared/lib/store-snapshot";
import {
  collectTagCounts,
  collectUniqueTags,
  resolveActiveTagFilter,
} from "../../../shared/lib/tags";
import type { StoreSnapshot } from "../../../shared/types/store";
import { contentBlockLabel } from "../../blocks/model";
import { renderDraftPreview } from "../../renderer/render-draft";
import { createTemplateFromDraftInput, type TemplateInput } from "../../templates/model";
import {
  applyTemplateToDraft,
  type DraftBlockInsertTarget,
  draftBlockInsertTargetLabel,
  draftHasMeaningfulContent,
  type DraftInput,
  insertContentBlockIntoDraft,
} from "../model";
import { formatDraftAutoSaveState, toDraftWorkspaceErrorMessage } from "./draft-workspace-helpers";
import { useDraftPersistenceState } from "./use-draft-persistence-state";
import { useDraftProofreadingState } from "./use-draft-proofreading-state";
import { useDraftVariablePresetsState } from "./use-draft-variable-presets-state";
import { useDraftWorkspaceDerivations } from "./use-draft-workspace-derivations";

type DetailedProofreadingTriggerField = "subject" | "opening" | "body" | "closing";

const detailedProofreadingTriggerFields = new Set<DetailedProofreadingTriggerField>([
  "subject",
  "opening",
  "body",
  "closing",
]);

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
  disabledRuleIds: string[];
  onDisableProofreadingRule: (ruleId: string) => Promise<void>;
  snapshot: StoreSnapshot;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onOpenTemplateInput: (input: TemplateInput) => void;
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
  disabledRuleIds,
  onDisableProofreadingRule,
  snapshot,
  onClearError,
  onError,
  onNotice,
  onOpenTemplateInput,
  onSnapshotChange,
}: DraftWorkspaceStateOptions) {
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSortOption>("recent");
  const [draftTagFilterState, setDraftTagFilter] = useState<string | null>(null);
  const deferredDraftSearchQuery = useDeferredValue(draftSearchQuery);
  const availableDraftTagCounts = useMemo(
    () => collectTagCounts(snapshot.drafts),
    [snapshot.drafts],
  );
  const availableDraftTags = useMemo(() => collectUniqueTags(snapshot.drafts), [snapshot.drafts]);
  const activeDraftTagFilter = useMemo(
    () => resolveActiveTagFilter(availableDraftTags, draftTagFilterState),
    [availableDraftTags, draftTagFilterState],
  );

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

  const {
    draftHistory,
    draftRenderResult,
    draftVariableNames,
    filteredDrafts,
    selectedDraftSignature,
  } = useDraftWorkspaceDerivations({
    activeDraftTag: activeDraftTagFilter,
    deferredDraftSearchQuery,
    draftForm,
    draftSort,
    snapshot,
  });
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
  const proofreadingState = useDraftProofreadingState({
    disabledRuleIds,
    draftForm,
    onDisableProofreadingRule,
    onNotice,
    renderIssues: draftRenderResult.issues,
    setDraftForm,
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

  const canCreateTemplate = draftHasMeaningfulContent(draftForm);

  function changeDraft<K extends keyof DraftInput>(field: K, value: DraftInput[K]) {
    if (isDetailedProofreadingTriggerField(field)) {
      proofreadingState.markDetailedProofreadingPending();
    }

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

  function createDraftWithReset() {
    proofreadingState.resetProofreadingState();
    createDraft();
  }

  function hydrateSnapshotWithReset(nextSnapshot: StoreSnapshot) {
    proofreadingState.resetProofreadingState();
    hydrateSnapshot(nextSnapshot);
  }

  function openDraftByIdWithReset(draftId: string, nextSnapshot?: StoreSnapshot) {
    proofreadingState.resetProofreadingState();
    openDraftById(draftId, nextSnapshot);
  }

  function openDraftInputWithReset(input: DraftInput) {
    proofreadingState.resetProofreadingState();
    openDraftInput(input);
  }

  function restoreDraftHistoryWithReset(historyId: string) {
    proofreadingState.resetProofreadingState();
    return restoreDraftHistory(historyId);
  }

  function selectDraftWithReset(id: string) {
    proofreadingState.resetProofreadingState();
    selectDraft(id);
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

    proofreadingState.resetProofreadingState();
    setDraftForm((current) => applyTemplateToDraft(current, template));
    onNotice(`テンプレート「${template.name}」を下書きに反映しました。`);
  }

  function createTemplateFromDraft() {
    if (!canCreateTemplate) {
      return;
    }

    flushPendingDraft();
    onOpenTemplateInput(createTemplateFromDraftInput(draftForm));
  }

  function insertBlock(target: DraftBlockInsertTarget, blockId: string) {
    const block = snapshot.blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }

    proofreadingState.markDetailedProofreadingPending();
    setDraftForm((current) => insertContentBlockIntoDraft(current, target, block));
    onNotice(
      `文面ブロック「${contentBlockLabel(block)}」を${draftBlockInsertTargetLabel(target)}に挿入しました。`,
    );
  }

  return {
    handle: {
      copyPreview,
      createDraft: createDraftWithReset,
      flushPendingDraft,
      hydrateSnapshot: hydrateSnapshotWithReset,
      openDraftById: openDraftByIdWithReset,
      openDraftInput: openDraftInputWithReset,
      saveDraft,
      togglePinned: toggleDraftPinned,
    } satisfies DraftWorkspaceHandle,
    workspaceProps: {
      activeTagFilter: activeDraftTagFilter,
      autoSaveLabel: formatDraftAutoSaveState(draftAutoSaveState),
      availableTags: availableDraftTags,
      tagCounts: availableDraftTagCounts,
      blocks: snapshot.blocks,
      canApplyVariablePreset: variablePresetState.canApplyVariablePreset,
      canCreateTemplate,
      canDuplicate: selectedDraftId !== null,
      canSaveVariablePreset: variablePresetState.canSaveVariablePreset,
      detailedCheckStatus: proofreadingState.detailedCheckStatus,
      detailedCheckStatusLabel: proofreadingState.detailedCheckStatusLabel,
      draftForm,
      draftHistory,
      drafts: filteredDrafts,
      issues: proofreadingState.issues,
      onApplyIssueSuggestion: proofreadingState.onApplyIssueSuggestion,
      onApplyTemplate: applyTemplate,
      onApplyVariablePreset: variablePresetState.applyVariablePreset,
      onApplyRecommendedVariablePreset: variablePresetState.applyVariablePresetById,
      onChangeDraft: changeDraft,
      onChangeDraftVariable: changeDraftVariable,
      onChangeSearchQuery: setDraftSearchQuery,
      onChangeSort: setDraftSort,
      onChangeTagFilter: setDraftTagFilter,
      onChangeVariablePresetName: variablePresetState.changeVariablePresetName,
      onCopyPreview: copyPreview,
      onCreateDraft: createDraftWithReset,
      onCreateTemplateFromDraft: createTemplateFromDraft,
      onCreateVariablePreset: variablePresetState.createVariablePreset,
      onDeleteDraft: deleteDraft,
      onDeleteVariablePreset: variablePresetState.deleteVariablePreset,
      onDisableIssueRule: proofreadingState.onDisableIssueRule,
      onDuplicateDraft: duplicateDraft,
      onInsertBlock: insertBlock,
      onIgnoreIssue: proofreadingState.onIgnoreIssue,
      onRunDetailedCheck: proofreadingState.onRunDetailedCheck,
      onRestoreDraftHistory: restoreDraftHistoryWithReset,
      onSaveDraft: saveDraft,
      onSaveVariablePreset: variablePresetState.saveVariablePreset,
      onSelectDraft: selectDraftWithReset,
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

function isDetailedProofreadingTriggerField(
  field: keyof DraftInput,
): field is DetailedProofreadingTriggerField {
  return detailedProofreadingTriggerFields.has(field as DetailedProofreadingTriggerField);
}

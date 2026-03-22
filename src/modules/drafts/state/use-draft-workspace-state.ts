import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

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
import { createDraftProofreadingRunner } from "../proofreading/create-proofreading-runner";
import {
  applyDraftProofreadingSuggestion,
  draftProofreadingDetailedStatusLabel,
  type DraftProofreadingIssue,
  mergeDraftProofreadingIssues,
} from "../proofreading/model";
import { formatDraftAutoSaveState, toDraftWorkspaceErrorMessage } from "./draft-workspace-helpers";
import { useDraftPersistenceState } from "./use-draft-persistence-state";
import { useDraftVariablePresetsState } from "./use-draft-variable-presets-state";

const DETAILED_PROOFREADING_DEBOUNCE_MS = 700;

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
  onSnapshotChange,
}: DraftWorkspaceStateOptions) {
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSortOption>("recent");
  const [detailedCheckStatus, setDetailedCheckStatus] = useState<
    "idle" | "pending" | "running" | "ready" | "error"
  >(() => (typeof Worker === "undefined" ? "idle" : "pending"));
  const [detailedCheckErrorMessage, setDetailedCheckErrorMessage] = useState<string | null>(null);
  const [detailedIssues, setDetailedIssues] = useState<DraftProofreadingIssue[]>([]);
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<string[]>([]);
  const detailedCheckTimerRef = useRef<number | null>(null);
  const detailedProofreadingRunnerRef =
    useRef<ReturnType<typeof createDraftProofreadingRunner>>(null);
  const detailedRequestVersionRef = useRef(0);
  const runDetailedProofreadingRef = useRef<() => Promise<void>>(async () => {});
  const deferredDraftSearchQuery = useDeferredValue(draftSearchQuery);

  function clearDetailedCheckTimer() {
    if (detailedCheckTimerRef.current === null) {
      return;
    }

    window.clearTimeout(detailedCheckTimerRef.current);
    detailedCheckTimerRef.current = null;
  }

  function ensureDetailedProofreadingRunner() {
    if (typeof Worker === "undefined") {
      return null;
    }

    if (detailedProofreadingRunnerRef.current) {
      return detailedProofreadingRunnerRef.current;
    }

    try {
      const runner = createDraftProofreadingRunner();
      detailedProofreadingRunnerRef.current = runner;
      return runner;
    } catch (error) {
      setDetailedIssues([]);
      setDetailedCheckErrorMessage(toDetailedProofreadingErrorMessage(error));
      setDetailedCheckStatus("error");
      return null;
    }
  }

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

  const selectedDraftSignature = useMemo(
    () => findTrashSignature(snapshot.signatures, snapshot.trash.signatures, draftForm.signatureId),
    [draftForm.signatureId, snapshot.signatures, snapshot.trash.signatures],
  );
  const signatureBody = selectedDraftSignature?.body ?? "";
  const draftVariableNames = useMemo(
    () => collectDraftVariableNames(draftForm, selectedDraftSignature),
    [draftForm, selectedDraftSignature],
  );
  const draftRenderResult = useMemo(
    () => buildDraftRenderResult(draftForm, selectedDraftSignature),
    [draftForm, selectedDraftSignature],
  );
  const mergedIssues = useMemo(
    () => mergeDraftProofreadingIssues(draftRenderResult.issues, detailedIssues),
    [detailedIssues, draftRenderResult.issues],
  );
  const visibleIssues = useMemo(
    () =>
      mergedIssues.filter(
        (issue) => !ignoredIssueIds.includes(issue.id) && !disabledRuleIds.includes(issue.ruleId),
      ),
    [disabledRuleIds, ignoredIssueIds, mergedIssues],
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
    return () => {
      clearDetailedCheckTimer();
      detailedRequestVersionRef.current += 1;
      detailedProofreadingRunnerRef.current?.dispose();
      detailedProofreadingRunnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    runDetailedProofreadingRef.current = async () => {
      clearDetailedCheckTimer();
      const runner = ensureDetailedProofreadingRunner();

      if (!runner) {
        return;
      }

      const requestVersion = ++detailedRequestVersionRef.current;
      setDetailedCheckErrorMessage(null);
      setDetailedCheckStatus("running");

      try {
        const nextIssues = await runner.run({
          draft: draftForm,
          signatureBody,
        });

        if (requestVersion !== detailedRequestVersionRef.current) {
          return;
        }

        setDetailedIssues(nextIssues);
        setDetailedCheckErrorMessage(null);
        setDetailedCheckStatus("ready");
      } catch (error) {
        if (requestVersion !== detailedRequestVersionRef.current) {
          return;
        }

        setDetailedIssues([]);
        setDetailedCheckErrorMessage(toDetailedProofreadingErrorMessage(error));
        setDetailedCheckStatus("error");
      }
    };
  }, [draftForm, signatureBody]);

  useEffect(() => {
    clearDetailedCheckTimer();

    if (typeof Worker === "undefined") {
      return;
    }

    detailedCheckTimerRef.current = window.setTimeout(() => {
      detailedCheckTimerRef.current = null;
      void runDetailedProofreadingRef.current();
    }, DETAILED_PROOFREADING_DEBOUNCE_MS);

    return () => {
      clearDetailedCheckTimer();
    };
  }, [
    draftForm.body,
    draftForm.closing,
    draftForm.id,
    draftForm.opening,
    draftForm.subject,
    signatureBody,
  ]);

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

  function resetIgnoredIssues() {
    setIgnoredIssueIds([]);
  }

  function markDetailedProofreadingPending() {
    setDetailedCheckErrorMessage(null);
    setDetailedCheckStatus(typeof Worker === "undefined" ? "idle" : "pending");
  }

  function resetDetailedProofreading() {
    clearDetailedCheckTimer();
    detailedRequestVersionRef.current += 1;
    setDetailedIssues([]);
    setDetailedCheckErrorMessage(null);
    markDetailedProofreadingPending();
  }

  function resetProofreadingState() {
    resetIgnoredIssues();
    resetDetailedProofreading();
  }

  function changeDraft<K extends keyof DraftInput>(field: K, value: DraftInput[K]) {
    if (field === "subject" || field === "opening" || field === "body" || field === "closing") {
      markDetailedProofreadingPending();
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

  function ignoreIssueOnce(issueId: string) {
    setIgnoredIssueIds((current) => (current.includes(issueId) ? current : [...current, issueId]));
  }

  function applyIssueSuggestion(issueId: string) {
    const issue = mergedIssues.find((item) => item.id === issueId);

    if (!issue?.suggestion) {
      return;
    }

    const { suggestion } = issue;

    setDraftForm((current) => applyDraftProofreadingSuggestion(current, suggestion));
    setIgnoredIssueIds((current) => current.filter((id) => id !== issueId));
    onNotice(`${issue.title} の候補を適用しました。`);
  }

  function runDetailedCheckNow() {
    void runDetailedProofreadingRef.current();
  }

  async function disableIssueRule(ruleId: string) {
    await onDisableProofreadingRule(ruleId);
  }

  function createDraftWithReset() {
    resetProofreadingState();
    createDraft();
  }

  function hydrateSnapshotWithReset(nextSnapshot: StoreSnapshot) {
    resetProofreadingState();
    hydrateSnapshot(nextSnapshot);
  }

  function openDraftByIdWithReset(draftId: string, nextSnapshot?: StoreSnapshot) {
    resetProofreadingState();
    openDraftById(draftId, nextSnapshot);
  }

  function openDraftInputWithReset(input: DraftInput) {
    resetProofreadingState();
    openDraftInput(input);
  }

  function restoreDraftHistoryWithReset(historyId: string) {
    resetProofreadingState();
    return restoreDraftHistory(historyId);
  }

  function selectDraftWithReset(id: string) {
    resetProofreadingState();
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

    resetProofreadingState();
    setDraftForm((current) => applyTemplateToDraft(current, template));
    onNotice(`テンプレート「${template.name}」を下書きに反映しました。`);
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
      autoSaveLabel: formatDraftAutoSaveState(draftAutoSaveState),
      canApplyVariablePreset: variablePresetState.canApplyVariablePreset,
      canDuplicate: selectedDraftId !== null,
      canSaveVariablePreset: variablePresetState.canSaveVariablePreset,
      detailedCheckStatus,
      detailedCheckStatusLabel: draftProofreadingDetailedStatusLabel(
        detailedCheckStatus,
        detailedCheckErrorMessage,
      ),
      draftForm,
      draftHistory,
      drafts: filteredDrafts,
      issues: visibleIssues,
      onApplyIssueSuggestion: applyIssueSuggestion,
      onApplyTemplate: applyTemplate,
      onApplyVariablePreset: variablePresetState.applyVariablePreset,
      onChangeDraft: changeDraft,
      onChangeDraftVariable: changeDraftVariable,
      onChangeSearchQuery: setDraftSearchQuery,
      onChangeSort: setDraftSort,
      onChangeVariablePresetName: variablePresetState.changeVariablePresetName,
      onCopyPreview: copyPreview,
      onCreateDraft: createDraftWithReset,
      onCreateVariablePreset: variablePresetState.createVariablePreset,
      onDeleteDraft: deleteDraft,
      onDeleteVariablePreset: variablePresetState.deleteVariablePreset,
      onDisableIssueRule: disableIssueRule,
      onDuplicateDraft: duplicateDraft,
      onIgnoreIssue: ignoreIssueOnce,
      onRunDetailedCheck: runDetailedCheckNow,
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

function toDetailedProofreadingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "不明なエラー";
}

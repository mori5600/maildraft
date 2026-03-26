import { type RefObject, useMemo } from "react";

import type { DraftWorkspaceHandle } from "../../modules/drafts/ui/DraftWorkspaceScreen";
import { useMemoWorkspaceState } from "../../modules/memo/state/use-memo-workspace-state";
import { useSettingsWorkspaceState } from "../../modules/settings/state/use-settings-workspace-state";
import { useSignatureWorkspaceState } from "../../modules/signatures/state/use-signature-workspace-state";
import { useTemplateWorkspaceState } from "../../modules/templates/state/use-template-workspace-state";
import { useTrashWorkspaceState } from "../../modules/trash/state/use-trash-workspace-state";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";
import { buildWorkspaceSummaries } from "./maildraft-app-helpers";
import {
  changeWorkspaceView,
  EMPTY_SNAPSHOT,
  hydrateImportedBackup,
  hydrateWorkspaceSnapshot,
} from "./maildraft-app-orchestration";
import { useAppBootstrap } from "./use-app-bootstrap";
import { useAppShellState } from "./use-app-shell-state";
import { useAppShortcuts } from "./use-app-shortcuts";

/**
 * Wires the app shell to workspace hooks and shared imperative draft actions.
 *
 * @remarks
 * Compact save and delete operations update individual workspaces in place, but bootstrap and
 * backup import replace the full snapshot and therefore rehydrate template, signature, and trash
 * selections together. Leaving the drafts view flushes pending draft state before the shell
 * switches workspaces.
 */
export function useMaildraftApp(draftWorkspaceRef: RefObject<DraftWorkspaceHandle | null>) {
  const shell = useAppShellState(EMPTY_SNAPSHOT);
  const memoState = useMemoWorkspaceState({
    onClearError: shell.clearError,
    onError: shell.setError,
    onNotice: shell.setNotice,
    onOpenDraftInput: (input) => draftWorkspaceRef.current?.openDraftInput(input),
    onSnapshotChange: shell.setSnapshot,
    onTrashItemSelect: shell.setSelectedTrashItemKey,
    onViewChange: shell.setViewState,
    snapshot: shell.snapshot,
  });

  const templateState = useTemplateWorkspaceState({
    onClearError: shell.clearError,
    onError: shell.setError,
    onFlushDraft: () => draftWorkspaceRef.current?.flushPendingDraft(),
    onNotice: shell.setNotice,
    onOpenDraftInput: (input) => draftWorkspaceRef.current?.openDraftInput(input),
    onSnapshotChange: shell.setSnapshot,
    onTrashItemSelect: shell.setSelectedTrashItemKey,
    onViewChange: shell.setViewState,
    snapshot: shell.snapshot,
  });
  const signatureState = useSignatureWorkspaceState({
    onClearError: shell.clearError,
    onError: shell.setError,
    onFlushDraft: () => draftWorkspaceRef.current?.flushPendingDraft(),
    onNotice: shell.setNotice,
    onSignatureSnapshotChange: templateState.syncTemplateSignatureId,
    onSnapshotChange: shell.setSnapshot,
    onTrashItemSelect: shell.setSelectedTrashItemKey,
    onViewChange: shell.setViewState,
    snapshot: shell.snapshot,
  });
  const settingsState = useSettingsWorkspaceState({
    onBackupImported: (nextSnapshot) => {
      hydrateImportedBackup(nextSnapshot, draftWorkspaceRef.current, hydrateAll);
    },
    onClearError: shell.clearError,
    onError: shell.setError,
    onNotice: shell.setNotice,
  });

  function hydrateAll(nextSnapshot: StoreSnapshot) {
    hydrateWorkspaceSnapshot(nextSnapshot, {
      hydrateMemoState: memoState.hydrateMemoState,
      hydrateSignatureState: signatureState.hydrateSignatureState,
      hydrateTemplateState: templateState.hydrateTemplateState,
      setSelectedTrashItemKey: shell.setSelectedTrashItemKey,
      setSnapshot: shell.setSnapshot,
    });
  }

  useAppBootstrap({
    hydrateEditorSettings: settingsState.hydrateEditorSettings,
    hydrateLoggingSettings: settingsState.hydrateLoggingSettings,
    hydrateProofreadingSettings: settingsState.hydrateProofreadingSettings,
    hydrateSnapshot: hydrateAll,
    onClearError: shell.clearError,
    onError: shell.setError,
    onLoadingChange: shell.setIsLoading,
    onNotice: shell.setNotice,
    onWarning: shell.setWarning,
  });

  const changeView = (nextView: WorkspaceView) =>
    changeWorkspaceView(nextView, {
      currentView: shell.view,
      flushDrafts: () => draftWorkspaceRef.current?.flushPendingDraft(),
      flushMemo: memoState.flushPendingMemo,
      flushSignatures: signatureState.flushPendingSignature,
      flushTemplates: templateState.flushPendingTemplate,
      setViewState: shell.setViewState,
    });

  const trashState = useTrashWorkspaceState({
    onClearError: shell.clearError,
    onDraftRestored: (draftId, nextSnapshot) =>
      draftWorkspaceRef.current?.openDraftById(draftId, nextSnapshot),
    onError: shell.setError,
    onMemoRestored: memoState.hydrateMemoState,
    onNotice: shell.setNotice,
    onSignatureRestored: (nextSnapshot, signatureId) => {
      signatureState.hydrateSignatureState(nextSnapshot, signatureId);
      templateState.syncTemplateSignatureId(nextSnapshot);
    },
    onSignatureSnapshotChange: templateState.syncTemplateSignatureId,
    onSnapshotChange: shell.setSnapshot,
    onTemplateRestored: templateState.hydrateTemplateState,
    onTrashSelectionChange: shell.setSelectedTrashItemKey,
    onViewChange: shell.setViewState,
    selectedTrashItemKey: shell.selectedTrashItemKey,
    snapshot: shell.snapshot,
  });

  const views = useMemo(
    () =>
      buildWorkspaceSummaries({
        draftCount: shell.snapshot.drafts.length,
        memoCount: shell.snapshot.memos.length,
        signatureCount: shell.snapshot.signatures.length,
        templateCount: shell.snapshot.templates.length,
        trashItemCount: trashState.trashItems.length,
      }),
    [
      shell.snapshot.drafts.length,
      shell.snapshot.memos.length,
      shell.snapshot.signatures.length,
      shell.snapshot.templates.length,
      trashState.trashItems.length,
    ],
  );

  function createDraft() {
    draftWorkspaceRef.current?.createDraft();
    shell.setViewState("drafts");
  }

  function createMemo() {
    memoState.createMemo();
  }

  function toggleMemoPinned() {
    memoState.toggleMemoPinned();
  }

  async function saveDraft() {
    await draftWorkspaceRef.current?.saveDraft();
  }

  async function copyDraftPreview() {
    await draftWorkspaceRef.current?.copyPreview();
  }

  function toggleDraftPinned() {
    draftWorkspaceRef.current?.togglePinned();
  }

  useAppShortcuts({
    actions: {
      changeView,
      copyDraftPreview,
      createDraft,
      createMemo,
      createSignature: signatureState.createSignature,
      createTemplate: templateState.createTemplate,
      saveDraft,
      saveSettingsSection: settingsState.saveSettingsSection,
      saveMemo: memoState.saveMemo,
      saveSignature: signatureState.saveSignature,
      saveTemplate: templateState.saveTemplate,
      toggleDraftPinned,
      toggleMemoPinned,
      toggleSignaturePinned: signatureState.toggleSignaturePinned,
      toggleTemplatePinned: templateState.toggleTemplatePinned,
    },
    isLoading: shell.isLoading,
    view: shell.view,
  });

  return {
    draftWorkspaceProps: {
      disabledProofreadingRuleIds:
        settingsState.settingsWorkspaceProps.proofreadingSettings.disabledRuleIds,
      editorSettings: settingsState.settingsWorkspaceProps.editorSettings,
      onDisableProofreadingRule: settingsState.disableProofreadingRule,
      onClearError: shell.clearError,
      onError: (message: string) => shell.setError(message),
      onNotice: (message: string) => shell.setNotice(message),
      onSnapshotChange: shell.setSnapshot,
      showWhitespace: shell.showWhitespace,
      snapshot: shell.snapshot,
    },
    error: shell.error,
    isLoading: shell.isLoading,
    memoWorkspaceProps: {
      ...memoState.memoWorkspaceProps,
      editorSettings: settingsState.settingsWorkspaceProps.editorSettings,
      showWhitespace: shell.showWhitespace,
    },
    notice: shell.notice,
    warning: shell.warning,
    settingsWorkspaceProps: settingsState.settingsWorkspaceProps,
    showWhitespace: shell.showWhitespace,
    signatureWorkspaceProps: {
      ...signatureState.signatureWorkspaceProps,
      editorSettings: settingsState.settingsWorkspaceProps.editorSettings,
      showWhitespace: shell.showWhitespace,
    },
    templateWorkspaceProps: {
      ...templateState.templateWorkspaceProps,
      editorSettings: settingsState.settingsWorkspaceProps.editorSettings,
      showWhitespace: shell.showWhitespace,
    },
    theme: shell.theme,
    toggleTheme: shell.toggleTheme,
    toggleWhitespace: shell.toggleWhitespace,
    trashWorkspaceProps: {
      ...trashState.trashWorkspaceProps,
      showWhitespace: shell.showWhitespace,
    },
    view: shell.view,
    views,
    setView: changeView,
  };
}

import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import type { StoreSnapshot } from "../../../shared/types/store";
import { normalizeEditorTabSize } from "../../../shared/ui/code-editor/editor-settings";
import { draftProofreadingRuleLabel } from "../../drafts/proofreading/model";
import {
  createDefaultEditorSettingsSnapshot,
  createDefaultLoggingSettingsSnapshot,
  createDefaultProofreadingSettingsSnapshot,
  type EditorSettingsInput,
  type EditorSettingsSnapshot,
  type LogEntrySnapshot,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  normalizeProofreadingRuleIds,
  type ProofreadingSettingsSnapshot,
  RECENT_LOG_LIMIT,
  toEditorSettingsInput,
  toLoggingSettingsInput,
} from "../model";
import type { SettingsSection } from "../ui/settings-workspace-content";

interface SettingsWorkspaceStateOptions {
  onBackupImported: (snapshot: StoreSnapshot) => void;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
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

/**
 * Owns editor and logging settings, backup import/export flow, and recent log loading.
 *
 * @remarks
 * Backup import replaces the full store snapshot through `onBackupImported` and then rehydrates
 * settings from the imported payload. Export, import, editor save, and recent-log refresh each
 * expose dedicated pending flags so the settings UI can gate duplicate actions.
 */
export function useSettingsWorkspaceState({
  onBackupImported,
  onClearError,
  onError,
  onNotice,
}: SettingsWorkspaceStateOptions) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("editor");
  const [editorSettings, setEditorSettings] = useState<EditorSettingsSnapshot>(
    createDefaultEditorSettingsSnapshot(),
  );
  const [editorForm, setEditorForm] = useState<EditorSettingsInput>(
    toEditorSettingsInput(createDefaultEditorSettingsSnapshot()),
  );
  const [loggingSettings, setLoggingSettings] = useState<LoggingSettingsSnapshot>(
    createDefaultLoggingSettingsSnapshot(),
  );
  const [loggingForm, setLoggingForm] = useState<LoggingSettingsInput>(
    toLoggingSettingsInput(createDefaultLoggingSettingsSnapshot()),
  );
  const [proofreadingSettings, setProofreadingSettings] = useState<ProofreadingSettingsSnapshot>(
    createDefaultProofreadingSettingsSnapshot(),
  );
  const [recentLogs, setRecentLogs] = useState<LogEntrySnapshot[]>([]);
  const [isLoadingRecentLogs, setIsLoadingRecentLogs] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isSavingEditorSettings, setIsSavingEditorSettings] = useState(false);
  const [isSavingProofreadingSettings, setIsSavingProofreadingSettings] = useState(false);
  const proofreadingSettingsRef = useRef(proofreadingSettings);

  useEffect(() => {
    proofreadingSettingsRef.current = proofreadingSettings;
  }, [proofreadingSettings]);

  function hydrateEditorSettings(nextEditorSettings: EditorSettingsSnapshot) {
    const normalized = toEditorSettingsInput(nextEditorSettings);
    setEditorSettings(normalized);
    setEditorForm(normalized);
  }

  function hydrateLoggingSettings(nextLoggingSettings: LoggingSettingsSnapshot) {
    setLoggingSettings(nextLoggingSettings);
    setLoggingForm(toLoggingSettingsInput(nextLoggingSettings));
  }

  function hydrateProofreadingSettings(nextProofreadingSettings: ProofreadingSettingsSnapshot) {
    const normalized = {
      disabledRuleIds: normalizeProofreadingRuleIds(nextProofreadingSettings.disabledRuleIds),
    };
    proofreadingSettingsRef.current = normalized;
    setProofreadingSettings(normalized);
  }

  function changeLogging<K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) {
    setLoggingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function changeEditor<K extends keyof EditorSettingsInput>(
    field: K,
    value: EditorSettingsInput[K],
  ) {
    setEditorForm((current) => ({
      ...current,
      [field]:
        field === "tabSize"
          ? normalizeEditorTabSize(value as EditorSettingsInput["tabSize"])
          : value,
    }));
  }

  async function saveLoggingSettings() {
    try {
      onClearError();
      const nextLoggingSettings = await maildraftApi.saveLoggingSettings(loggingForm);
      hydrateLoggingSettings(nextLoggingSettings);
      onNotice("ログ設定を保存しました。");
    } catch (saveError) {
      onError(toErrorMessage(saveError));
    }
  }

  async function saveEditorSettings() {
    try {
      onClearError();
      setIsSavingEditorSettings(true);
      const nextEditorSettings = await maildraftApi.saveEditorSettings(editorForm);
      hydrateEditorSettings(nextEditorSettings);
      onNotice("エディタ設定を保存しました。");
    } catch (saveError) {
      onError(toErrorMessage(saveError));
    } finally {
      setIsSavingEditorSettings(false);
    }
  }

  async function clearLogs() {
    try {
      onClearError();
      const nextLoggingSettings = await maildraftApi.clearLogs();
      hydrateLoggingSettings(nextLoggingSettings);
      setRecentLogs([]);
      onNotice("診断ログを削除しました。");
    } catch (clearError) {
      onError(toErrorMessage(clearError));
    }
  }

  async function saveProofreadingRuleIds(
    nextRuleIds: string[],
    successMessage: string,
  ): Promise<void> {
    try {
      onClearError();
      setIsSavingProofreadingSettings(true);
      const nextProofreadingSettings = await maildraftApi.saveProofreadingSettings({
        disabledRuleIds: normalizeProofreadingRuleIds(nextRuleIds),
      });
      hydrateProofreadingSettings(nextProofreadingSettings);
      onNotice(successMessage);
    } catch (saveError) {
      onError(toErrorMessage(saveError));
    } finally {
      setIsSavingProofreadingSettings(false);
    }
  }

  async function disableProofreadingRule(ruleId: string) {
    const normalizedRuleId = normalizeProofreadingRuleIds([ruleId])[0];
    const currentRuleIds = proofreadingSettingsRef.current.disabledRuleIds;

    if (!normalizedRuleId || currentRuleIds.includes(normalizedRuleId)) {
      return;
    }

    await saveProofreadingRuleIds(
      [...currentRuleIds, normalizedRuleId],
      `校正ルール「${draftProofreadingRuleLabel(normalizedRuleId)}」を無効化しました。`,
    );
  }

  async function enableProofreadingRule(ruleId: string) {
    const normalizedRuleId = normalizeProofreadingRuleIds([ruleId])[0];
    const currentRuleIds = proofreadingSettingsRef.current.disabledRuleIds;

    if (!normalizedRuleId || !currentRuleIds.includes(normalizedRuleId)) {
      return;
    }

    await saveProofreadingRuleIds(
      currentRuleIds.filter((currentRuleId) => currentRuleId !== normalizedRuleId),
      `校正ルール「${draftProofreadingRuleLabel(normalizedRuleId)}」を有効化しました。`,
    );
  }

  async function resetDisabledProofreadingRules() {
    if (proofreadingSettingsRef.current.disabledRuleIds.length === 0) {
      return;
    }

    await saveProofreadingRuleIds([], "無効化していた校正ルールをすべて有効化しました。");
  }

  async function refreshRecentLogs({ silent = false }: { silent?: boolean } = {}) {
    try {
      if (!silent) {
        onClearError();
      }

      setIsLoadingRecentLogs(true);
      const nextRecentLogs = await maildraftApi.loadRecentLogs(RECENT_LOG_LIMIT);
      setRecentLogs(nextRecentLogs);

      if (!silent) {
        onNotice("最近のログを更新しました。");
      }
    } catch (loadError) {
      onError(toErrorMessage(loadError));
    } finally {
      setIsLoadingRecentLogs(false);
    }
  }

  async function exportBackup() {
    try {
      onClearError();
      setIsExportingBackup(true);
      const exportedPath = await maildraftApi.exportBackup();
      if (!exportedPath) {
        return;
      }
      onNotice("バックアップを書き出しました。");
    } catch (exportError) {
      onError(toErrorMessage(exportError));
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function importBackup() {
    try {
      onClearError();
      const confirmed = await confirm(
        "バックアップを読み込むと、現在の下書き・テンプレート・署名・メモ・履歴を置き換えます。続けますか？",
        {
          title: "MailDraft",
          kind: "warning",
          okLabel: "読み込む",
          cancelLabel: "キャンセル",
        },
      );

      if (!confirmed) {
        return;
      }

      setIsImportingBackup(true);
      const imported = await maildraftApi.importBackup();
      if (!imported) {
        return;
      }
      onBackupImported(imported.snapshot);
      hydrateEditorSettings(imported.editorSettings);
      hydrateLoggingSettings(imported.loggingSettings);
      hydrateProofreadingSettings(imported.proofreadingSettings);
      onNotice("バックアップを読み込みました。");
    } catch (importError) {
      onError(toErrorMessage(importError));
    } finally {
      setIsImportingBackup(false);
    }
  }

  async function saveSettingsSection() {
    if (activeSection === "editor") {
      await saveEditorSettings();
      return;
    }

    if (activeSection === "logging") {
      await saveLoggingSettings();
    }
  }

  return {
    hydrateEditorSettings,
    hydrateLoggingSettings,
    hydrateProofreadingSettings,
    disableProofreadingRule,
    enableProofreadingRule,
    resetDisabledProofreadingRules,
    saveSettingsSection,
    saveEditorSettings,
    saveLoggingSettings,
    settingsWorkspaceProps: {
      activeSection,
      editorForm,
      editorSettings,
      isSavingEditorSettings,
      isExportingBackup,
      isImportingBackup,
      isLoadingRecentLogs,
      isSavingProofreadingSettings,
      loggingForm,
      loggingSettings,
      onChangeEditor: changeEditor,
      proofreadingSettings,
      onSaveEditorSettings: saveEditorSettings,
      onSelectSection: setActiveSection,
      onChangeLogging: changeLogging,
      onClearLogs: clearLogs,
      onEnableProofreadingRule: enableProofreadingRule,
      onExportBackup: exportBackup,
      onImportBackup: importBackup,
      onResetDisabledProofreadingRules: resetDisabledProofreadingRules,
      onRefreshRecentLogs: refreshRecentLogs,
      onSaveLoggingSettings: saveLoggingSettings,
      recentLogs,
    },
  };
}

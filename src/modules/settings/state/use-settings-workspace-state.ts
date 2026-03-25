import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import type { StoreSnapshot } from "../../../shared/types/store";
import { draftProofreadingRuleLabel } from "../../drafts/proofreading/model";
import {
  createDefaultLoggingSettingsSnapshot,
  createDefaultProofreadingSettingsSnapshot,
  type LogEntrySnapshot,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  normalizeProofreadingRuleIds,
  type ProofreadingSettingsSnapshot,
  RECENT_LOG_LIMIT,
  toLoggingSettingsInput,
} from "../model";

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
 * Owns logging settings, backup import/export flow, and recent log loading for the settings view.
 *
 * @remarks
 * Backup import replaces the full store snapshot through `onBackupImported` and then rehydrates
 * logging settings from the imported payload. Export, import, and recent-log refresh each expose
 * dedicated pending flags so the settings UI can gate duplicate actions.
 */
export function useSettingsWorkspaceState({
  onBackupImported,
  onClearError,
  onError,
  onNotice,
}: SettingsWorkspaceStateOptions) {
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
  const [isSavingProofreadingSettings, setIsSavingProofreadingSettings] = useState(false);
  const proofreadingSettingsRef = useRef(proofreadingSettings);

  useEffect(() => {
    proofreadingSettingsRef.current = proofreadingSettings;
  }, [proofreadingSettings]);

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
      hydrateLoggingSettings(imported.loggingSettings);
      hydrateProofreadingSettings(imported.proofreadingSettings);
      onNotice("バックアップを読み込みました。");
    } catch (importError) {
      onError(toErrorMessage(importError));
    } finally {
      setIsImportingBackup(false);
    }
  }

  return {
    hydrateLoggingSettings,
    hydrateProofreadingSettings,
    disableProofreadingRule,
    enableProofreadingRule,
    resetDisabledProofreadingRules,
    saveLoggingSettings,
    settingsWorkspaceProps: {
      isExportingBackup,
      isImportingBackup,
      isLoadingRecentLogs,
      isSavingProofreadingSettings,
      loggingForm,
      loggingSettings,
      proofreadingSettings,
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

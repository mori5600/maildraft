import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { BACKUP_FILE_FILTER, createBackupDefaultFileName } from "../../../shared/lib/backup";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createDefaultLoggingSettingsSnapshot,
  type LogEntrySnapshot,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
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
  const [recentLogs, setRecentLogs] = useState<LogEntrySnapshot[]>([]);
  const [isLoadingRecentLogs, setIsLoadingRecentLogs] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  function hydrateLoggingSettings(nextLoggingSettings: LoggingSettingsSnapshot) {
    setLoggingSettings(nextLoggingSettings);
    setLoggingForm(toLoggingSettingsInput(nextLoggingSettings));
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
      const path = await save({
        title: "MailDraft バックアップを書き出す",
        defaultPath: createBackupDefaultFileName(),
        filters: [BACKUP_FILE_FILTER],
      });

      if (!path) {
        return;
      }

      await maildraftApi.exportBackup(path);
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
        "バックアップを読み込むと、現在の下書き・テンプレート・署名・履歴を置き換えます。続けますか？",
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
      const selected = await open({
        title: "MailDraft バックアップを読み込む",
        multiple: false,
        filters: [BACKUP_FILE_FILTER],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const imported = await maildraftApi.importBackup(selected);
      onBackupImported(imported.snapshot);
      hydrateLoggingSettings(imported.loggingSettings);
      onNotice("バックアップを読み込みました。");
    } catch (importError) {
      onError(toErrorMessage(importError));
    } finally {
      setIsImportingBackup(false);
    }
  }

  return {
    hydrateLoggingSettings,
    saveLoggingSettings,
    settingsWorkspaceProps: {
      isExportingBackup,
      isImportingBackup,
      isLoadingRecentLogs,
      loggingForm,
      loggingSettings,
      onChangeLogging: changeLogging,
      onClearLogs: clearLogs,
      onExportBackup: exportBackup,
      onImportBackup: importBackup,
      onRefreshRecentLogs: refreshRecentLogs,
      onSaveLoggingSettings: saveLoggingSettings,
      recentLogs,
    },
  };
}

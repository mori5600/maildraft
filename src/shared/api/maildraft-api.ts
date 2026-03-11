import { invoke } from "@tauri-apps/api/core";

import type { DraftInput } from "../../modules/drafts/model";
import type {
  ImportedBackupSnapshot,
  LogEntrySnapshot,
  LoggingSettingsInput,
  LoggingSettingsSnapshot,
} from "../../modules/settings/model";
import type { SignatureInput } from "../../modules/signatures/model";
import type { TemplateInput } from "../../modules/templates/model";
import type { StoreSnapshot } from "../types/store";

export const maildraftApi = {
  loadSnapshot() {
    return invoke<StoreSnapshot>("load_snapshot");
  },
  saveDraft(input: DraftInput) {
    return invoke<StoreSnapshot>("save_draft", { input });
  },
  deleteDraft(id: string) {
    return invoke<StoreSnapshot>("delete_draft", { id });
  },
  restoreDraftHistory(draftId: string, historyId: string) {
    return invoke<StoreSnapshot>("restore_draft_history", { draftId, historyId });
  },
  saveTemplate(input: TemplateInput) {
    return invoke<StoreSnapshot>("save_template", { input });
  },
  deleteTemplate(id: string) {
    return invoke<StoreSnapshot>("delete_template", { id });
  },
  saveSignature(input: SignatureInput) {
    return invoke<StoreSnapshot>("save_signature", { input });
  },
  deleteSignature(id: string) {
    return invoke<StoreSnapshot>("delete_signature", { id });
  },
  loadLoggingSettings() {
    return invoke<LoggingSettingsSnapshot>("load_logging_settings");
  },
  exportBackup(path: string) {
    return invoke<string>("export_backup", { path });
  },
  importBackup(path: string) {
    return invoke<ImportedBackupSnapshot>("import_backup", { path });
  },
  loadRecentLogs(limit?: number) {
    return invoke<LogEntrySnapshot[]>("load_recent_logs", { limit });
  },
  saveLoggingSettings(input: LoggingSettingsInput) {
    return invoke<LoggingSettingsSnapshot>("save_logging_settings", { input });
  },
  clearLogs() {
    return invoke<LoggingSettingsSnapshot>("clear_logs");
  },
};

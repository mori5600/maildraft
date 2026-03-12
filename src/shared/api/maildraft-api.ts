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
  restoreDraftFromTrash(id: string) {
    return invoke<StoreSnapshot>("restore_draft_from_trash", { id });
  },
  permanentlyDeleteDraftFromTrash(id: string) {
    return invoke<StoreSnapshot>("permanently_delete_draft_from_trash", { id });
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
  restoreTemplateFromTrash(id: string) {
    return invoke<StoreSnapshot>("restore_template_from_trash", { id });
  },
  permanentlyDeleteTemplateFromTrash(id: string) {
    return invoke<StoreSnapshot>("permanently_delete_template_from_trash", { id });
  },
  saveSignature(input: SignatureInput) {
    return invoke<StoreSnapshot>("save_signature", { input });
  },
  deleteSignature(id: string) {
    return invoke<StoreSnapshot>("delete_signature", { id });
  },
  restoreSignatureFromTrash(id: string) {
    return invoke<StoreSnapshot>("restore_signature_from_trash", { id });
  },
  permanentlyDeleteSignatureFromTrash(id: string) {
    return invoke<StoreSnapshot>("permanently_delete_signature_from_trash", { id });
  },
  emptyTrash() {
    return invoke<StoreSnapshot>("empty_trash");
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

import { invoke } from "@tauri-apps/api/core";

import type { DraftInput } from "../../modules/drafts/model";
import type { VariablePresetInput } from "../../modules/drafts/variable-presets";
import type { Memo, MemoInput } from "../../modules/memo/model";
import type {
  EditorSettingsInput,
  EditorSettingsSnapshot,
  ImportedBackupSnapshot,
  LogEntrySnapshot,
  LoggingSettingsInput,
  LoggingSettingsSnapshot,
  ProofreadingSettingsInput,
  ProofreadingSettingsSnapshot,
} from "../../modules/settings/model";
import type { SignatureInput } from "../../modules/signatures/model";
import type { TemplateInput } from "../../modules/templates/model";
import type {
  DeleteDraftResult,
  DeleteMemoResult,
  DeleteSignatureResult,
  DeleteTemplateResult,
  SaveDraftResult,
  SaveSignatureResult,
  SaveTemplateResult,
  StartupNoticeSnapshot,
  StoreSnapshot,
  TrashMutationResult,
  VariablePresetResult,
} from "../types/store";

/** Tauri command wrapper. Save commands may return compact payloads. */
export const maildraftApi = {
  loadSnapshot() {
    return invoke<StoreSnapshot>("load_snapshot");
  },

  loadStartupNotice() {
    return invoke<StartupNoticeSnapshot | null>("load_startup_notice");
  },

  saveDraft(input: DraftInput) {
    return invoke<SaveDraftResult>("save_draft", { input });
  },

  saveMemo(input: MemoInput) {
    return invoke<Memo>("save_memo", { input });
  },

  deleteMemo(id: string) {
    return invoke<DeleteMemoResult>("delete_memo", { id });
  },

  restoreMemoFromTrash(id: string) {
    return invoke<Memo>("restore_memo_from_trash", { id });
  },

  permanentlyDeleteMemoFromTrash(id: string) {
    return invoke<TrashMutationResult>("permanently_delete_memo_from_trash", { id });
  },

  deleteDraft(id: string) {
    return invoke<DeleteDraftResult>("delete_draft", { id });
  },

  restoreDraftFromTrash(id: string) {
    return invoke<SaveDraftResult>("restore_draft_from_trash", { id });
  },

  permanentlyDeleteDraftFromTrash(id: string) {
    return invoke<TrashMutationResult>("permanently_delete_draft_from_trash", { id });
  },

  restoreDraftHistory(draftId: string, historyId: string) {
    return invoke<SaveDraftResult>("restore_draft_history", { draftId, historyId });
  },

  saveVariablePreset(input: VariablePresetInput) {
    return invoke<VariablePresetResult>("save_variable_preset", { input });
  },

  deleteVariablePreset(id: string) {
    return invoke<VariablePresetResult>("delete_variable_preset", { id });
  },

  saveTemplate(input: TemplateInput) {
    return invoke<SaveTemplateResult>("save_template", { input });
  },

  deleteTemplate(id: string) {
    return invoke<DeleteTemplateResult>("delete_template", { id });
  },

  restoreTemplateFromTrash(id: string) {
    return invoke<SaveTemplateResult>("restore_template_from_trash", { id });
  },

  permanentlyDeleteTemplateFromTrash(id: string) {
    return invoke<TrashMutationResult>("permanently_delete_template_from_trash", { id });
  },

  saveSignature(input: SignatureInput) {
    return invoke<SaveSignatureResult>("save_signature", { input });
  },

  deleteSignature(id: string) {
    return invoke<DeleteSignatureResult>("delete_signature", { id });
  },

  restoreSignatureFromTrash(id: string) {
    return invoke<SaveSignatureResult>("restore_signature_from_trash", { id });
  },

  permanentlyDeleteSignatureFromTrash(id: string) {
    return invoke<TrashMutationResult>("permanently_delete_signature_from_trash", { id });
  },

  emptyTrash() {
    return invoke<TrashMutationResult>("empty_trash");
  },

  loadLoggingSettings() {
    return invoke<LoggingSettingsSnapshot>("load_logging_settings");
  },

  loadEditorSettings() {
    return invoke<EditorSettingsSnapshot>("load_editor_settings");
  },

  loadProofreadingSettings() {
    return invoke<ProofreadingSettingsSnapshot>("load_proofreading_settings");
  },

  exportBackup() {
    return invoke<string | null>("export_backup");
  },

  importBackup() {
    return invoke<ImportedBackupSnapshot | null>("import_backup");
  },

  loadRecentLogs(limit?: number) {
    return invoke<LogEntrySnapshot[]>("load_recent_logs", { limit });
  },

  saveLoggingSettings(input: LoggingSettingsInput) {
    return invoke<LoggingSettingsSnapshot>("save_logging_settings", { input });
  },

  saveEditorSettings(input: EditorSettingsInput) {
    return invoke<EditorSettingsSnapshot>("save_editor_settings", { input });
  },

  saveProofreadingSettings(input: ProofreadingSettingsInput) {
    return invoke<ProofreadingSettingsSnapshot>("save_proofreading_settings", { input });
  },

  clearLogs() {
    return invoke<LoggingSettingsSnapshot>("clear_logs");
  },
};

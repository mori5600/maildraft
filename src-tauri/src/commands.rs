use crate::app::state::AppState;
use crate::app::{
    backup::ImportedBackupSnapshot,
    logging::LogEntrySnapshot,
    settings::{LoggingSettingsInput, LoggingSettingsSnapshot},
    storage::StartupNoticeSnapshot,
};
use crate::modules::{
    drafts::DraftInput,
    signatures::SignatureInput,
    store::{
        DeleteDraftResult, DeleteSignatureResult, DeleteTemplateResult, SaveDraftResult,
        SaveSignatureResult, SaveTemplateResult, StoreSnapshot, TrashMutationResult,
    },
    templates::TemplateInput,
    variable_presets::VariablePresetInput,
};

fn load_snapshot_impl(state: &AppState) -> Result<StoreSnapshot, String> {
    state.load_snapshot()
}

fn load_startup_notice_impl(state: &AppState) -> Result<Option<StartupNoticeSnapshot>, String> {
    state.load_startup_notice()
}

fn save_draft_impl(state: &AppState, input: DraftInput) -> Result<SaveDraftResult, String> {
    state.save_draft(input)
}

fn delete_draft_impl(state: &AppState, id: String) -> Result<DeleteDraftResult, String> {
    state.delete_draft(&id)
}

fn restore_draft_from_trash_impl(state: &AppState, id: String) -> Result<SaveDraftResult, String> {
    state.restore_draft_from_trash(&id)
}

fn permanently_delete_draft_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_draft_from_trash(&id)
}

fn restore_draft_history_impl(
    state: &AppState,
    draft_id: String,
    history_id: String,
) -> Result<SaveDraftResult, String> {
    state.restore_draft_history(&draft_id, &history_id)
}

fn save_template_impl(
    state: &AppState,
    input: TemplateInput,
) -> Result<SaveTemplateResult, String> {
    state.save_template(input)
}

fn save_variable_preset_impl(
    state: &AppState,
    input: VariablePresetInput,
) -> Result<StoreSnapshot, String> {
    state.save_variable_preset(input)
}

fn delete_variable_preset_impl(state: &AppState, id: String) -> Result<StoreSnapshot, String> {
    state.delete_variable_preset(&id)
}

fn delete_template_impl(state: &AppState, id: String) -> Result<DeleteTemplateResult, String> {
    state.delete_template(&id)
}

fn restore_template_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<SaveTemplateResult, String> {
    state.restore_template_from_trash(&id)
}

fn permanently_delete_template_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_template_from_trash(&id)
}

fn save_signature_impl(
    state: &AppState,
    input: SignatureInput,
) -> Result<SaveSignatureResult, String> {
    state.save_signature(input)
}

fn delete_signature_impl(state: &AppState, id: String) -> Result<DeleteSignatureResult, String> {
    state.delete_signature(&id)
}

fn restore_signature_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<SaveSignatureResult, String> {
    state.restore_signature_from_trash(&id)
}

fn permanently_delete_signature_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_signature_from_trash(&id)
}

fn empty_trash_impl(state: &AppState) -> Result<TrashMutationResult, String> {
    state.empty_trash()
}

fn load_logging_settings_impl(state: &AppState) -> Result<LoggingSettingsSnapshot, String> {
    state.load_logging_settings()
}

fn export_backup_impl(state: &AppState, path: String) -> Result<String, String> {
    state.export_backup(&path)
}

fn import_backup_impl(state: &AppState, path: String) -> Result<ImportedBackupSnapshot, String> {
    state.import_backup(&path)
}

fn load_recent_logs_impl(
    state: &AppState,
    limit: Option<usize>,
) -> Result<Vec<LogEntrySnapshot>, String> {
    state.load_recent_logs(limit)
}

fn save_logging_settings_impl(
    state: &AppState,
    input: LoggingSettingsInput,
) -> Result<LoggingSettingsSnapshot, String> {
    state.save_logging_settings(input)
}

fn clear_logs_impl(state: &AppState) -> Result<LoggingSettingsSnapshot, String> {
    state.clear_logs()
}

#[tauri::command]
pub(crate) fn load_snapshot(state: tauri::State<'_, AppState>) -> Result<StoreSnapshot, String> {
    load_snapshot_impl(&state)
}

#[tauri::command]
pub(crate) fn load_startup_notice(
    state: tauri::State<'_, AppState>,
) -> Result<Option<StartupNoticeSnapshot>, String> {
    load_startup_notice_impl(&state)
}

#[tauri::command]
pub(crate) fn save_draft(
    state: tauri::State<'_, AppState>,
    input: DraftInput,
) -> Result<SaveDraftResult, String> {
    save_draft_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_draft(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteDraftResult, String> {
    delete_draft_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_draft_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<SaveDraftResult, String> {
    restore_draft_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_draft_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_draft_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_draft_history(
    state: tauri::State<'_, AppState>,
    draft_id: String,
    history_id: String,
) -> Result<SaveDraftResult, String> {
    restore_draft_history_impl(&state, draft_id, history_id)
}

#[tauri::command]
pub(crate) fn save_template(
    state: tauri::State<'_, AppState>,
    input: TemplateInput,
) -> Result<SaveTemplateResult, String> {
    save_template_impl(&state, input)
}

#[tauri::command]
pub(crate) fn save_variable_preset(
    state: tauri::State<'_, AppState>,
    input: VariablePresetInput,
) -> Result<StoreSnapshot, String> {
    save_variable_preset_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_variable_preset(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    delete_variable_preset_impl(&state, id)
}

#[tauri::command]
pub(crate) fn delete_template(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteTemplateResult, String> {
    delete_template_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_template_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<SaveTemplateResult, String> {
    restore_template_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_template_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_template_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn save_signature(
    state: tauri::State<'_, AppState>,
    input: SignatureInput,
) -> Result<SaveSignatureResult, String> {
    save_signature_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_signature(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteSignatureResult, String> {
    delete_signature_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_signature_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<SaveSignatureResult, String> {
    restore_signature_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_signature_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_signature_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn empty_trash(state: tauri::State<'_, AppState>) -> Result<TrashMutationResult, String> {
    empty_trash_impl(&state)
}

#[tauri::command]
pub(crate) fn load_logging_settings(
    state: tauri::State<'_, AppState>,
) -> Result<LoggingSettingsSnapshot, String> {
    load_logging_settings_impl(&state)
}

#[tauri::command]
pub(crate) fn export_backup(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    export_backup_impl(&state, path)
}

#[tauri::command]
pub(crate) fn import_backup(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<ImportedBackupSnapshot, String> {
    import_backup_impl(&state, path)
}

#[tauri::command]
pub(crate) fn load_recent_logs(
    state: tauri::State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<LogEntrySnapshot>, String> {
    load_recent_logs_impl(&state, limit)
}

#[tauri::command]
pub(crate) fn save_logging_settings(
    state: tauri::State<'_, AppState>,
    input: LoggingSettingsInput,
) -> Result<LoggingSettingsSnapshot, String> {
    save_logging_settings_impl(&state, input)
}

#[tauri::command]
pub(crate) fn clear_logs(
    state: tauri::State<'_, AppState>,
) -> Result<LoggingSettingsSnapshot, String> {
    clear_logs_impl(&state)
}

#[cfg(test)]
mod tests {
    use std::{collections::BTreeMap, fs};

    use pretty_assertions::assert_eq;
    use tempfile::tempdir;

    use super::*;

    fn make_state() -> (AppState, tempfile::TempDir) {
        let directory = tempdir().expect("tempdir");
        let state = AppState::new_for_tests(directory.path()).expect("state");
        (state, directory)
    }

    #[test]
    fn draft_commands_round_trip_snapshot_history_and_trash() {
        let (state, _directory) = make_state();
        let initial = load_snapshot_impl(&state).expect("load snapshot");
        assert_eq!(initial.drafts.len(), 1);
        assert_eq!(
            load_startup_notice_impl(&state).expect("load startup notice"),
            None
        );

        let saved = save_draft_impl(
            &state,
            DraftInput {
                id: "draft-command".to_string(),
                title: "確認依頼".to_string(),
                is_pinned: false,
                subject: "ご確認ください".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "内容をご確認ください。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                template_id: Some("template-thanks".to_string()),
                signature_id: Some("signature-default".to_string()),
                variable_values: BTreeMap::from([("担当者名".to_string(), "山田様".to_string())]),
            },
        )
        .expect("save draft");
        assert_eq!(saved.draft.id, "draft-command");

        let trashed = delete_draft_impl(&state, "draft-command".to_string()).expect("trash draft");
        assert_eq!(trashed.trashed_draft.draft.id, "draft-command");

        let restored =
            restore_draft_from_trash_impl(&state, "draft-command".to_string()).expect("restore");
        assert_eq!(restored.draft.id, "draft-command");

        let updated = save_draft_impl(
            &state,
            DraftInput {
                id: "draft-command".to_string(),
                title: "確認依頼".to_string(),
                is_pinned: true,
                subject: "件名を更新しました".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "修正版です。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                template_id: Some("template-thanks".to_string()),
                signature_id: Some("signature-default".to_string()),
                variable_values: BTreeMap::new(),
            },
        )
        .expect("update draft");
        let history = updated
            .draft_history
            .iter()
            .find(|entry| entry.draft_id == "draft-command")
            .expect("history entry");

        let restored_history =
            restore_draft_history_impl(&state, "draft-command".to_string(), history.id.clone())
                .expect("restore history");
        let restored_draft = &restored_history.draft;
        assert_eq!(restored_draft.subject, "ご確認ください");
        assert!(restored_history
            .draft_history
            .iter()
            .any(|entry| entry.draft_id == "draft-command"));

        delete_draft_impl(&state, "draft-command".to_string()).expect("trash again");
        let permanently_deleted =
            permanently_delete_draft_from_trash_impl(&state, "draft-command".to_string())
                .expect("delete permanently");
        assert!(permanently_deleted
            .trash
            .drafts
            .iter()
            .all(|draft| draft.draft.id != "draft-command"));
    }

    #[test]
    fn template_signature_and_variable_preset_commands_round_trip() {
        let (state, _directory) = make_state();

        let templates = save_template_impl(
            &state,
            TemplateInput {
                id: "template-command".to_string(),
                name: "督促".to_string(),
                is_pinned: true,
                subject: "ご確認のお願い".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "ご確認ください。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                signature_id: Some("signature-default".to_string()),
            },
        )
        .expect("save template");
        assert_eq!(templates.template.id, "template-command");

        let presets = save_variable_preset_impl(
            &state,
            VariablePresetInput {
                id: "preset-command".to_string(),
                name: "A社".to_string(),
                values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
            },
        )
        .expect("save preset");
        assert_eq!(presets.variable_presets.len(), 1);

        let without_preset = delete_variable_preset_impl(&state, "preset-command".to_string())
            .expect("delete preset");
        assert!(without_preset.variable_presets.is_empty());

        let signatures = save_signature_impl(
            &state,
            SignatureInput {
                id: "signature-command".to_string(),
                name: "営業署名".to_string(),
                is_pinned: false,
                body: "株式会社△△\n山田 太郎".to_string(),
                is_default: false,
            },
        )
        .expect("save signature");
        assert!(signatures
            .signatures
            .iter()
            .any(|signature| signature.id == "signature-command"));

        delete_template_impl(&state, "template-command".to_string()).expect("trash template");
        let restored_template =
            restore_template_from_trash_impl(&state, "template-command".to_string())
                .expect("restore template");
        assert_eq!(restored_template.template.id, "template-command");

        delete_template_impl(&state, "template-command".to_string()).expect("trash template");
        let removed_template =
            permanently_delete_template_from_trash_impl(&state, "template-command".to_string())
                .expect("delete template permanently");
        assert!(removed_template
            .trash
            .templates
            .iter()
            .all(|template| template.template.id != "template-command"));
        assert!(removed_template.drafts.is_some());
        assert!(removed_template.draft_history.is_some());

        delete_signature_impl(&state, "signature-command".to_string()).expect("trash signature");
        let restored_signature =
            restore_signature_from_trash_impl(&state, "signature-command".to_string())
                .expect("restore signature");
        assert!(restored_signature
            .signatures
            .iter()
            .any(|signature| signature.id == "signature-command"));

        delete_signature_impl(&state, "signature-command".to_string()).expect("trash signature");
        let removed_signature =
            permanently_delete_signature_from_trash_impl(&state, "signature-command".to_string())
                .expect("delete signature permanently");
        assert!(removed_signature
            .trash
            .signatures
            .iter()
            .all(|signature| signature.signature.id != "signature-command"));
        assert!(removed_signature.drafts.is_some());
        assert!(removed_signature.draft_history.is_some());
        assert!(removed_signature.templates.is_some());
    }

    #[test]
    fn settings_and_logs_commands_round_trip() {
        let (state, _directory) = make_state();

        let initial = load_logging_settings_impl(&state).expect("load settings");
        assert_eq!(initial.mode, crate::app::settings::LoggingMode::ErrorsOnly);

        let saved = save_logging_settings_impl(
            &state,
            LoggingSettingsInput {
                mode: crate::app::settings::LoggingMode::Standard,
                retention_days: 30,
            },
        )
        .expect("save settings");
        assert_eq!(saved.retention_days, 30);

        let recent = load_recent_logs_impl(&state, Some(5)).expect("load recent logs");
        assert!(recent.len() <= 5);

        let cleared = clear_logs_impl(&state).expect("clear logs");
        assert_eq!(cleared.file_count, 0);
    }

    #[test]
    fn backup_commands_export_and_import_state() {
        let (state, directory) = make_state();
        let export_path = directory.path().join("backup.maildraft.json");

        save_template_impl(
            &state,
            TemplateInput {
                id: "template-backup".to_string(),
                name: "ご案内".to_string(),
                is_pinned: false,
                subject: "ご案内".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "本文です。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                signature_id: Some("signature-default".to_string()),
            },
        )
        .expect("save template");

        let written =
            export_backup_impl(&state, export_path.display().to_string()).expect("export");
        assert_eq!(written, export_path.display().to_string());
        assert!(fs::exists(&export_path).expect("backup exists"));

        delete_template_impl(&state, "template-backup".to_string()).expect("trash template");
        let imported =
            import_backup_impl(&state, export_path.display().to_string()).expect("import");
        assert!(imported
            .snapshot
            .templates
            .iter()
            .any(|template| template.id == "template-backup"));
    }

    #[test]
    fn empty_trash_command_clears_all_trash_kinds() {
        let (state, _directory) = make_state();

        delete_draft_impl(&state, "draft-welcome".to_string()).expect("trash draft");
        delete_template_impl(&state, "template-thanks".to_string()).expect("trash template");
        delete_signature_impl(&state, "signature-default".to_string()).expect("trash signature");

        let emptied = empty_trash_impl(&state).expect("empty trash");
        assert!(emptied.trash.drafts.is_empty());
        assert!(emptied.trash.templates.is_empty());
        assert!(emptied.trash.signatures.is_empty());
        assert!(emptied.drafts.is_some());
    }
}

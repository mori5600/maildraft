mod app;
mod modules;

use std::io::Error;

use app::state::AppState;
use app::{
    backup::ImportedBackupSnapshot,
    logging::LogEntrySnapshot,
    settings::{LoggingSettingsInput, LoggingSettingsSnapshot},
};
use modules::{
    drafts::DraftInput, signatures::SignatureInput, store::StoreSnapshot, templates::TemplateInput,
};

#[tauri::command]
fn load_snapshot(state: tauri::State<'_, AppState>) -> Result<StoreSnapshot, String> {
    state.load_snapshot()
}

#[tauri::command]
fn save_draft(
    state: tauri::State<'_, AppState>,
    input: DraftInput,
) -> Result<StoreSnapshot, String> {
    state.save_draft(input)
}

#[tauri::command]
fn delete_draft(state: tauri::State<'_, AppState>, id: String) -> Result<StoreSnapshot, String> {
    state.delete_draft(&id)
}

#[tauri::command]
fn restore_draft_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.restore_draft_from_trash(&id)
}

#[tauri::command]
fn permanently_delete_draft_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.permanently_delete_draft_from_trash(&id)
}

#[tauri::command]
fn restore_draft_history(
    state: tauri::State<'_, AppState>,
    draft_id: String,
    history_id: String,
) -> Result<StoreSnapshot, String> {
    state.restore_draft_history(&draft_id, &history_id)
}

#[tauri::command]
fn save_template(
    state: tauri::State<'_, AppState>,
    input: TemplateInput,
) -> Result<StoreSnapshot, String> {
    state.save_template(input)
}

#[tauri::command]
fn delete_template(state: tauri::State<'_, AppState>, id: String) -> Result<StoreSnapshot, String> {
    state.delete_template(&id)
}

#[tauri::command]
fn restore_template_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.restore_template_from_trash(&id)
}

#[tauri::command]
fn permanently_delete_template_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.permanently_delete_template_from_trash(&id)
}

#[tauri::command]
fn save_signature(
    state: tauri::State<'_, AppState>,
    input: SignatureInput,
) -> Result<StoreSnapshot, String> {
    state.save_signature(input)
}

#[tauri::command]
fn delete_signature(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.delete_signature(&id)
}

#[tauri::command]
fn restore_signature_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.restore_signature_from_trash(&id)
}

#[tauri::command]
fn permanently_delete_signature_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<StoreSnapshot, String> {
    state.permanently_delete_signature_from_trash(&id)
}

#[tauri::command]
fn empty_trash(state: tauri::State<'_, AppState>) -> Result<StoreSnapshot, String> {
    state.empty_trash()
}

#[tauri::command]
fn load_logging_settings(
    state: tauri::State<'_, AppState>,
) -> Result<LoggingSettingsSnapshot, String> {
    state.load_logging_settings()
}

#[tauri::command]
fn export_backup(state: tauri::State<'_, AppState>, path: String) -> Result<String, String> {
    state.export_backup(&path)
}

#[tauri::command]
fn import_backup(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<ImportedBackupSnapshot, String> {
    state.import_backup(&path)
}

#[tauri::command]
fn load_recent_logs(
    state: tauri::State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<LogEntrySnapshot>, String> {
    state.load_recent_logs(limit)
}

#[tauri::command]
fn save_logging_settings(
    state: tauri::State<'_, AppState>,
    input: LoggingSettingsInput,
) -> Result<LoggingSettingsSnapshot, String> {
    state.save_logging_settings(input)
}

#[tauri::command]
fn clear_logs(state: tauri::State<'_, AppState>) -> Result<LoggingSettingsSnapshot, String> {
    state.clear_logs()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = AppState::new(app.handle()).map_err(Error::other)?;
            tauri::Manager::manage(app, state);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_draft,
            delete_draft,
            restore_draft_from_trash,
            permanently_delete_draft_from_trash,
            restore_draft_history,
            save_template,
            delete_template,
            restore_template_from_trash,
            permanently_delete_template_from_trash,
            save_signature,
            delete_signature,
            restore_signature_from_trash,
            permanently_delete_signature_from_trash,
            empty_trash,
            load_logging_settings,
            export_backup,
            import_backup,
            load_recent_logs,
            save_logging_settings,
            clear_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

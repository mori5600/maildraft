use crate::app::state::AppState;
use crate::app::{
    backup::ImportedBackupSnapshot,
    logging::LogEntrySnapshot,
    settings::{
        EditorSettingsInput, EditorSettingsSnapshot, LoggingSettingsInput, LoggingSettingsSnapshot,
        ProofreadingSettingsInput, ProofreadingSettingsSnapshot,
    },
};
use chrono::{Datelike, Local, Timelike};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

pub(crate) fn load_logging_settings_impl(
    state: &AppState,
) -> Result<LoggingSettingsSnapshot, String> {
    state.load_logging_settings()
}

pub(crate) fn load_proofreading_settings_impl(
    state: &AppState,
) -> Result<ProofreadingSettingsSnapshot, String> {
    state.load_proofreading_settings()
}

pub(crate) fn load_editor_settings_impl(state: &AppState) -> Result<EditorSettingsSnapshot, String> {
    state.load_editor_settings()
}

pub(crate) fn export_backup_impl(state: &AppState, path: String) -> Result<String, String> {
    state.export_backup(&path)
}

pub(crate) fn import_backup_impl(
    state: &AppState,
    path: String,
) -> Result<ImportedBackupSnapshot, String> {
    state.import_backup(&path)
}

fn selected_dialog_path_to_string(path: FilePath) -> Result<String, String> {
    let path = path
        .into_path()
        .map_err(|_| "選択したファイルパスを処理できませんでした。".to_string())?;
    Ok(path.display().to_string())
}

pub(crate) fn backup_default_file_name_from_parts(
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
) -> String {
    format!("maildraft-backup-{year:04}{month:02}{day:02}-{hour:02}{minute:02}.json")
}

fn create_backup_default_file_name() -> String {
    let now = Local::now();
    backup_default_file_name_from_parts(
        now.year(),
        now.month(),
        now.day(),
        now.hour(),
        now.minute(),
    )
}

async fn pick_backup_export_path(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("MailDraft バックアップを書き出す")
            .set_file_name(create_backup_default_file_name())
            .add_filter("MailDraft バックアップ", &["json"])
            .blocking_save_file()
            .map(selected_dialog_path_to_string)
            .transpose()
    })
    .await
    .map_err(|error| error.to_string())?
}

async fn pick_backup_import_path(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("MailDraft バックアップを読み込む")
            .add_filter("MailDraft バックアップ", &["json"])
            .blocking_pick_file()
            .map(selected_dialog_path_to_string)
            .transpose()
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(crate) fn load_recent_logs_impl(
    state: &AppState,
    limit: Option<usize>,
) -> Result<Vec<LogEntrySnapshot>, String> {
    state.load_recent_logs(limit)
}

pub(crate) fn save_logging_settings_impl(
    state: &AppState,
    input: LoggingSettingsInput,
) -> Result<LoggingSettingsSnapshot, String> {
    state.save_logging_settings(input)
}

pub(crate) fn save_editor_settings_impl(
    state: &AppState,
    input: EditorSettingsInput,
) -> Result<EditorSettingsSnapshot, String> {
    state.save_editor_settings(input)
}

pub(crate) fn save_proofreading_settings_impl(
    state: &AppState,
    input: ProofreadingSettingsInput,
) -> Result<ProofreadingSettingsSnapshot, String> {
    state.save_proofreading_settings(input)
}

pub(crate) fn clear_logs_impl(state: &AppState) -> Result<LoggingSettingsSnapshot, String> {
    state.clear_logs()
}

#[tauri::command]
pub(crate) fn load_logging_settings(
    state: tauri::State<'_, AppState>,
) -> Result<LoggingSettingsSnapshot, String> {
    load_logging_settings_impl(&state)
}

#[tauri::command]
pub(crate) fn load_proofreading_settings(
    state: tauri::State<'_, AppState>,
) -> Result<ProofreadingSettingsSnapshot, String> {
    load_proofreading_settings_impl(&state)
}

#[tauri::command]
pub(crate) fn load_editor_settings(
    state: tauri::State<'_, AppState>,
) -> Result<EditorSettingsSnapshot, String> {
    load_editor_settings_impl(&state)
}

#[tauri::command]
pub(crate) async fn export_backup(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let Some(path) = pick_backup_export_path(app).await? else {
        return Ok(None);
    };

    export_backup_impl(&state, path).map(Some)
}

#[tauri::command]
pub(crate) async fn import_backup(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<ImportedBackupSnapshot>, String> {
    let Some(path) = pick_backup_import_path(app).await? else {
        return Ok(None);
    };

    import_backup_impl(&state, path).map(Some)
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
pub(crate) fn save_editor_settings(
    state: tauri::State<'_, AppState>,
    input: EditorSettingsInput,
) -> Result<EditorSettingsSnapshot, String> {
    save_editor_settings_impl(&state, input)
}

#[tauri::command]
pub(crate) fn save_proofreading_settings(
    state: tauri::State<'_, AppState>,
    input: ProofreadingSettingsInput,
) -> Result<ProofreadingSettingsSnapshot, String> {
    save_proofreading_settings_impl(&state, input)
}

#[tauri::command]
pub(crate) fn clear_logs(
    state: tauri::State<'_, AppState>,
) -> Result<LoggingSettingsSnapshot, String> {
    clear_logs_impl(&state)
}

mod backup;
mod context;
mod errors;
mod persistence;
mod rollback;
mod startup;

use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use serde_json::{json, Value};
use tempfile::tempdir;

use super::{
    context::{
        draft_context, logging_settings_context, memo_context, merge_context,
        proofreading_settings_context, snapshot_counts_context, template_context,
        trash_kind_context, variable_preset_context,
    },
    AppState,
};
use crate::{
    app::{
        backup::{decode_backup_document, BackupDocument},
        logging::{LogEntry, LogLevel},
        persistence::{sqlite::SqliteRepository, PersistenceRepository},
        settings::{
            AppSettings, EditorIndentStyle, EditorSettings, EditorSettingsInput, LoggingMode,
            LoggingSettings, LoggingSettingsInput, ProofreadingSettings, ProofreadingSettingsInput,
        },
        storage::{
            load_app_settings, load_store_snapshot, write_app_settings, write_store_snapshot,
            StartupNoticeTone,
        },
        validation::MAX_BACKUP_FILE_BYTES,
    },
    modules::{
        drafts::DraftInput,
        memo::{Memo, MemoInput},
        signatures::SignatureInput,
        store::StoreSnapshot,
        templates::TemplateInput,
        variable_presets::VariablePresetInput,
    },
};

fn make_state() -> (AppState, tempfile::TempDir) {
    let directory = tempdir().expect("tempdir");
    let state = AppState::new_for_tests(directory.path()).expect("state");
    (state, directory)
}

fn make_runtime_state() -> (AppState, tempfile::TempDir) {
    let directory = tempdir().expect("tempdir");
    let state = AppState::new_for_runtime_tests(directory.path()).expect("runtime state");
    (state, directory)
}

fn read_store(path: &Path) -> StoreSnapshot {
    load_store_snapshot(path).expect("store snapshot")
}

fn read_settings_file(path: &Path) -> AppSettings {
    load_app_settings(path).expect("settings file")
}

fn read_sqlite_store(path: &Path) -> StoreSnapshot {
    SqliteRepository::new(path.to_path_buf())
        .load_store_snapshot()
        .expect("sqlite store snapshot")
        .value
}

fn read_sqlite_settings(path: &Path) -> AppSettings {
    SqliteRepository::new(path.to_path_buf())
        .load_app_settings()
        .expect("sqlite settings")
        .value
}

fn runtime_database_path(root: &Path) -> PathBuf {
    root.join("maildraft.sqlite3")
}

fn store_file_path(state: &AppState) -> std::path::PathBuf {
    state.store_document_path_for_tests()
}

fn settings_file_path(state: &AppState) -> std::path::PathBuf {
    state.settings_document_path_for_tests()
}

fn backup_path(path: &Path) -> std::path::PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .expect("backup file name");
    path.with_file_name(format!("{}.bak", file_name))
}

fn snapshot_value(state: &AppState) -> Value {
    serde_json::to_value(state.load_snapshot().expect("load snapshot")).expect("serialize snapshot")
}

fn settings_value(state: &AppState) -> Value {
    let settings = state.settings.lock().expect("settings lock").clone();
    serde_json::to_value(settings).expect("serialize settings")
}

fn block_store_persistence(state: &mut AppState, directory: &Path, name: &str) {
    let blocked_path = directory.join(name);
    fs::create_dir_all(&blocked_path).expect("create blocked store path");
    let settings_path = settings_file_path(state);
    state.replace_json_repository_for_tests(blocked_path, settings_path);
}

fn block_settings_persistence(state: &mut AppState, directory: &Path, name: &str) {
    let blocked_path = directory.join(name);
    fs::create_dir_all(&blocked_path).expect("create blocked settings path");
    let store_path = store_file_path(state);
    state.replace_json_repository_for_tests(store_path, blocked_path);
}

fn replace_logs_directory_with_file(root: &Path) {
    let logs_path = root.join("logs");
    if logs_path.exists() {
        fs::remove_dir_all(&logs_path).expect("remove logs dir");
    }
    fs::write(&logs_path, "blocked").expect("block logs path");
}

fn assert_store_operation_rolls_back_on_persist_failure<T>(
    state: &mut AppState,
    directory: &Path,
    blocked_name: &str,
    operation: impl FnOnce(&AppState) -> Result<T, String>,
) {
    let original_store_path = store_file_path(state);
    let before_memory = snapshot_value(state);
    let before_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    block_store_persistence(state, directory, blocked_name);

    let error = match operation(state) {
        Ok(_) => panic!("operation unexpectedly succeeded"),
        Err(error) => error,
    };
    assert!(!error.is_empty());

    let after_memory = snapshot_value(state);
    let after_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    assert_eq!(after_memory, before_memory);
    assert_eq!(after_disk, before_disk);
}

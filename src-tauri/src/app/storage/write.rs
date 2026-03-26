use std::path::Path;

use crate::{
    app::{
        settings::AppSettings,
        validation::{ensure_content_size, MAX_SETTINGS_FILE_BYTES, MAX_STORE_FILE_BYTES},
    },
    modules::store::StoreSnapshot,
};

use super::{
    atomic_write::write_json_safely, settings_document::encode_settings,
    store_document::encode_store_snapshot, AppResult,
};

/// Writes app settings with the current storage document format.
///
/// # Errors
///
/// Returns an error if settings cannot be encoded or written atomically.
pub fn write_app_settings(path: &Path, settings: &AppSettings) -> AppResult<()> {
    let content = encode_settings(settings)?;
    ensure_content_size(
        &content,
        MAX_SETTINGS_FILE_BYTES,
        "設定ファイルが大きすぎるため保存できませんでした。",
    )?;
    write_json_safely(path, &content)
}

/// Writes the store snapshot with the current storage document format.
///
/// # Errors
///
/// Returns an error if the snapshot cannot be encoded or written atomically.
pub fn write_store_snapshot(path: &Path, snapshot: &StoreSnapshot) -> AppResult<()> {
    let content = encode_store_snapshot(snapshot)?;
    ensure_content_size(
        &content,
        MAX_STORE_FILE_BYTES,
        "保存ファイルが大きすぎるため保存できませんでした。",
    )?;
    write_json_safely(path, &content)
}

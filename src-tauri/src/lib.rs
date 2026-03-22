//! Tauri entrypoint and backend wiring for MailDraft.
#![warn(rustdoc::broken_intra_doc_links)]

mod app;
mod commands;
mod modules;

use std::io::Error;

use app::state::AppState;
use commands::{
    clear_logs, delete_draft, delete_memo, delete_signature, delete_template,
    delete_variable_preset, empty_trash, export_backup, import_backup, load_logging_settings,
    load_proofreading_settings, load_recent_logs, load_snapshot, load_startup_notice,
    permanently_delete_draft_from_trash, permanently_delete_memo_from_trash,
    permanently_delete_signature_from_trash, permanently_delete_template_from_trash,
    restore_draft_from_trash, restore_draft_history, restore_memo_from_trash,
    restore_signature_from_trash, restore_template_from_trash, save_draft, save_logging_settings,
    save_memo, save_proofreading_settings, save_signature, save_template, save_variable_preset,
};

/// Starts the Tauri runtime.
///
/// # Panics
///
/// Panics if the Tauri runtime cannot be started.
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
            load_startup_notice,
            save_draft,
            save_memo,
            delete_memo,
            restore_memo_from_trash,
            permanently_delete_memo_from_trash,
            delete_draft,
            restore_draft_from_trash,
            permanently_delete_draft_from_trash,
            restore_draft_history,
            save_template,
            save_variable_preset,
            delete_variable_preset,
            delete_template,
            restore_template_from_trash,
            permanently_delete_template_from_trash,
            save_signature,
            delete_signature,
            restore_signature_from_trash,
            permanently_delete_signature_from_trash,
            empty_trash,
            load_logging_settings,
            load_proofreading_settings,
            export_backup,
            import_backup,
            load_recent_logs,
            save_logging_settings,
            save_proofreading_settings,
            clear_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

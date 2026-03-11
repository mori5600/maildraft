mod app;
mod modules;

use std::io::Error;

use app::state::AppState;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = AppState::new(&app.handle()).map_err(Error::other)?;
            tauri::Manager::manage(app, state);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_draft,
            delete_draft,
            save_template,
            delete_template,
            save_signature,
            delete_signature
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

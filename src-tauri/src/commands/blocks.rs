use crate::app::state::AppState;
use crate::modules::{
    blocks::ContentBlockInput,
    store::{DeleteBlockResult, SaveBlockResult, TrashMutationResult},
};

pub(crate) fn save_block_impl(
    state: &AppState,
    input: ContentBlockInput,
) -> Result<SaveBlockResult, String> {
    state.save_block(input)
}

pub(crate) fn delete_block_impl(
    state: &AppState,
    id: String,
) -> Result<DeleteBlockResult, String> {
    state.delete_block(&id)
}

pub(crate) fn restore_block_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<SaveBlockResult, String> {
    state.restore_block_from_trash(&id)
}

pub(crate) fn permanently_delete_block_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_block_from_trash(&id)
}

#[tauri::command]
pub(crate) fn save_block(
    state: tauri::State<'_, AppState>,
    input: ContentBlockInput,
) -> Result<SaveBlockResult, String> {
    save_block_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_block(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteBlockResult, String> {
    delete_block_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_block_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<SaveBlockResult, String> {
    restore_block_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_block_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_block_from_trash_impl(&state, id)
}

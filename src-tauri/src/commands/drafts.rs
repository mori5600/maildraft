use crate::app::state::AppState;
use crate::modules::{
    drafts::DraftInput,
    store::{DeleteDraftResult, SaveDraftResult, TrashMutationResult},
};

pub(crate) fn save_draft_impl(
    state: &AppState,
    input: DraftInput,
) -> Result<SaveDraftResult, String> {
    state.save_draft(input)
}

pub(crate) fn delete_draft_impl(state: &AppState, id: String) -> Result<DeleteDraftResult, String> {
    state.delete_draft(&id)
}

pub(crate) fn restore_draft_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<SaveDraftResult, String> {
    state.restore_draft_from_trash(&id)
}

pub(crate) fn permanently_delete_draft_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_draft_from_trash(&id)
}

pub(crate) fn restore_draft_history_impl(
    state: &AppState,
    draft_id: String,
    history_id: String,
) -> Result<SaveDraftResult, String> {
    state.restore_draft_history(&draft_id, &history_id)
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

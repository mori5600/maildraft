use crate::app::state::AppState;
use crate::modules::{
    memo::{Memo, MemoInput},
    store::{DeleteMemoResult, TrashMutationResult},
};

pub(crate) fn save_memo_impl(state: &AppState, input: MemoInput) -> Result<Memo, String> {
    state.save_memo(input)
}

pub(crate) fn delete_memo_impl(state: &AppState, id: String) -> Result<DeleteMemoResult, String> {
    state.delete_memo(&id)
}

pub(crate) fn restore_memo_from_trash_impl(state: &AppState, id: String) -> Result<Memo, String> {
    state.restore_memo_from_trash(&id)
}

pub(crate) fn permanently_delete_memo_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_memo_from_trash(&id)
}

#[tauri::command]
pub(crate) fn save_memo(
    state: tauri::State<'_, AppState>,
    input: MemoInput,
) -> Result<Memo, String> {
    save_memo_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_memo(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteMemoResult, String> {
    delete_memo_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_memo_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Memo, String> {
    restore_memo_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_memo_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_memo_from_trash_impl(&state, id)
}

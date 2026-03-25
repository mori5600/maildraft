use crate::app::state::AppState;
use crate::modules::store::TrashMutationResult;

pub(crate) fn empty_trash_impl(state: &AppState) -> Result<TrashMutationResult, String> {
    state.empty_trash()
}

#[tauri::command]
pub(crate) fn empty_trash(
    state: tauri::State<'_, AppState>,
) -> Result<TrashMutationResult, String> {
    empty_trash_impl(&state)
}

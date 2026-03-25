use crate::app::{state::AppState, storage::StartupNoticeSnapshot};
use crate::modules::store::StoreSnapshot;

pub(crate) fn load_snapshot_impl(state: &AppState) -> Result<StoreSnapshot, String> {
    state.load_snapshot()
}

pub(crate) fn load_startup_notice_impl(
    state: &AppState,
) -> Result<Option<StartupNoticeSnapshot>, String> {
    state.load_startup_notice()
}

#[tauri::command]
pub(crate) fn load_snapshot(state: tauri::State<'_, AppState>) -> Result<StoreSnapshot, String> {
    load_snapshot_impl(&state)
}

#[tauri::command]
pub(crate) fn load_startup_notice(
    state: tauri::State<'_, AppState>,
) -> Result<Option<StartupNoticeSnapshot>, String> {
    load_startup_notice_impl(&state)
}

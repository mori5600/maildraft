use crate::app::state::AppState;
use crate::modules::{
    signatures::SignatureInput,
    store::{DeleteSignatureResult, SaveSignatureResult, TrashMutationResult},
};

pub(crate) fn save_signature_impl(
    state: &AppState,
    input: SignatureInput,
) -> Result<SaveSignatureResult, String> {
    state.save_signature(input)
}

pub(crate) fn delete_signature_impl(
    state: &AppState,
    id: String,
) -> Result<DeleteSignatureResult, String> {
    state.delete_signature(&id)
}

pub(crate) fn restore_signature_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<SaveSignatureResult, String> {
    state.restore_signature_from_trash(&id)
}

pub(crate) fn permanently_delete_signature_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_signature_from_trash(&id)
}

#[tauri::command]
pub(crate) fn save_signature(
    state: tauri::State<'_, AppState>,
    input: SignatureInput,
) -> Result<SaveSignatureResult, String> {
    save_signature_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_signature(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteSignatureResult, String> {
    delete_signature_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_signature_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<SaveSignatureResult, String> {
    restore_signature_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_signature_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_signature_from_trash_impl(&state, id)
}

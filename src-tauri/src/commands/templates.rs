use crate::app::state::AppState;
use crate::modules::{
    store::{DeleteTemplateResult, SaveTemplateResult, TrashMutationResult},
    templates::TemplateInput,
};

pub(crate) fn save_template_impl(
    state: &AppState,
    input: TemplateInput,
) -> Result<SaveTemplateResult, String> {
    state.save_template(input)
}

pub(crate) fn delete_template_impl(
    state: &AppState,
    id: String,
) -> Result<DeleteTemplateResult, String> {
    state.delete_template(&id)
}

pub(crate) fn restore_template_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<SaveTemplateResult, String> {
    state.restore_template_from_trash(&id)
}

pub(crate) fn permanently_delete_template_from_trash_impl(
    state: &AppState,
    id: String,
) -> Result<TrashMutationResult, String> {
    state.permanently_delete_template_from_trash(&id)
}

#[tauri::command]
pub(crate) fn save_template(
    state: tauri::State<'_, AppState>,
    input: TemplateInput,
) -> Result<SaveTemplateResult, String> {
    save_template_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_template(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<DeleteTemplateResult, String> {
    delete_template_impl(&state, id)
}

#[tauri::command]
pub(crate) fn restore_template_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<SaveTemplateResult, String> {
    restore_template_from_trash_impl(&state, id)
}

#[tauri::command]
pub(crate) fn permanently_delete_template_from_trash(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<TrashMutationResult, String> {
    permanently_delete_template_from_trash_impl(&state, id)
}

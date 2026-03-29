use crate::app::state::AppState;
use crate::modules::{store::VariablePresetResult, variable_presets::VariablePresetInput};

pub(crate) fn save_variable_preset_impl(
    state: &AppState,
    input: VariablePresetInput,
) -> Result<VariablePresetResult, String> {
    state.save_variable_preset(input)
}

pub(crate) fn delete_variable_preset_impl(
    state: &AppState,
    id: String,
) -> Result<VariablePresetResult, String> {
    state.delete_variable_preset(&id)
}

pub(crate) fn record_variable_preset_usage_impl(
    state: &AppState,
    id: String,
) -> Result<VariablePresetResult, String> {
    state.record_variable_preset_usage(&id)
}

#[tauri::command]
pub(crate) fn save_variable_preset(
    state: tauri::State<'_, AppState>,
    input: VariablePresetInput,
) -> Result<VariablePresetResult, String> {
    save_variable_preset_impl(&state, input)
}

#[tauri::command]
pub(crate) fn delete_variable_preset(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<VariablePresetResult, String> {
    delete_variable_preset_impl(&state, id)
}

#[tauri::command]
pub(crate) fn record_variable_preset_usage(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<VariablePresetResult, String> {
    record_variable_preset_usage_impl(&state, id)
}

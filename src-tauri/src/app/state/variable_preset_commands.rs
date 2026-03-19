use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::{
    store::{StoreSnapshot, VariablePresetResult},
    variable_presets::VariablePresetInput,
};

use super::{
    context::{
        elapsed_millis, merge_context, snapshot_counts_context, timestamp, variable_preset_context,
    },
    AppResult, AppState,
};

impl AppState {
    fn collect_variable_preset_result(store: &StoreSnapshot) -> VariablePresetResult {
        VariablePresetResult {
            variable_presets: store.variable_presets.clone(),
        }
    }

    /// Saves one variable preset and persists the updated store.
    ///
    /// The response returns only the preset collection because this operation does not require a
    /// full snapshot refresh on the frontend.
    ///
    /// # Errors
    ///
    /// Returns an error if the store lock cannot be acquired or persistence fails.
    pub fn save_variable_preset(&self, input: VariablePresetInput) -> AppResult<VariablePresetResult> {
        let started_at = Instant::now();
        let safe_context = variable_preset_context(&input);
        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            store.upsert_variable_preset(input, &timestamp());
            store.ensure_consistency();
            self.persist_locked_store(&store)?;
            let variable_preset_result = Self::collect_variable_preset_result(&store);
            let snapshot_context = snapshot_counts_context(&store);

            Ok((variable_preset_result, snapshot_context))
        })();

        match result {
            Ok((variable_preset_result, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "variable_preset.save",
                    module: "variable_presets",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_context),
                });
                Ok(variable_preset_result)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "variable_preset.save",
                    module: "variable_presets",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    /// Deletes one variable preset and persists the updated store.
    ///
    /// The response returns only the remaining preset collection.
    ///
    /// # Errors
    ///
    /// Returns an error if the preset does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn delete_variable_preset(&self, id: &str) -> AppResult<VariablePresetResult> {
        let started_at = Instant::now();
        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;

            if !store.delete_variable_preset(id) {
                return Err("指定した変数値セットが見つかりませんでした。".to_string());
            }

            store.ensure_consistency();
            self.persist_locked_store(&store)?;
            let variable_preset_result = Self::collect_variable_preset_result(&store);
            let snapshot_context = snapshot_counts_context(&store);

            Ok((variable_preset_result, snapshot_context))
        })();

        match result {
            Ok((variable_preset_result, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "variable_preset.delete",
                    module: "variable_presets",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });

                Ok(variable_preset_result)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "variable_preset.delete",
                    module: "variable_presets",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("VARIABLE_PRESET_NOT_FOUND"),
                    safe_context: Map::new(),
                });

                Err(error)
            }
        }
    }
}

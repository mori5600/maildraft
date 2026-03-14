use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::{store::StoreSnapshot, variable_presets::VariablePresetInput};

use super::{
    context::{
        elapsed_millis, merge_context, snapshot_counts_context, timestamp, variable_preset_context,
    },
    AppResult, AppState,
};

impl AppState {
    pub fn save_variable_preset(&self, input: VariablePresetInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = variable_preset_context(&input);

        match self.mutate_store(|store| {
            store.upsert_variable_preset(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "variable_preset.save",
                    module: "variable_presets",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_counts_context(&snapshot)),
                });
                Ok(snapshot)
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

    pub fn delete_variable_preset(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;

        if !store.delete_variable_preset(id) {
            self.log_event(LogEntry {
                level: LogLevel::Error,
                event_name: "variable_preset.delete",
                module: "variable_presets",
                result: "failure",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: Some("VARIABLE_PRESET_NOT_FOUND"),
                safe_context: Map::new(),
            });
            return Err("指定した変数値セットが見つかりませんでした。".to_string());
        }

        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "variable_preset.delete",
            module: "variable_presets",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: snapshot_counts_context(&snapshot),
        });

        Ok(snapshot)
    }
}

use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::{store::StoreSnapshot, templates::TemplateInput};

use super::{
    context::{
        elapsed_millis, merge_context, snapshot_counts_context, template_context, timestamp,
    },
    AppResult, AppState,
};

impl AppState {
    pub fn save_template(&self, input: TemplateInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = template_context(&input);

        match self.mutate_store(|store| {
            store.upsert_template(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.save",
                    module: "templates",
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
                    event_name: "template.save",
                    module: "templates",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    pub fn delete_template(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.delete_template(id, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.trash",
                    module: "templates",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Ok(snapshot)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "template.trash",
                    module: "templates",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }
}

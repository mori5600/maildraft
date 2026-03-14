use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::{signatures::SignatureInput, store::StoreSnapshot};

use super::{
    context::{
        elapsed_millis, merge_context, signature_context, snapshot_counts_context, timestamp,
    },
    AppResult, AppState,
};

impl AppState {
    pub fn save_signature(&self, input: SignatureInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = signature_context(&input);

        match self.mutate_store(|store| {
            store.upsert_signature(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "signature.save",
                    module: "signatures",
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
                    event_name: "signature.save",
                    module: "signatures",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    pub fn delete_signature(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.delete_signature(id, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "signature.trash",
                    module: "signatures",
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
                    event_name: "signature.trash",
                    module: "signatures",
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

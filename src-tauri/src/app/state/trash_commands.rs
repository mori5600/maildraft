use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::store::StoreSnapshot;

use super::{
    context::{elapsed_millis, snapshot_counts_context},
    AppResult, AppState,
};

impl AppState {
    pub fn restore_draft_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.restore_item_from_trash("draft", |store| store.restore_draft_from_trash(id))
    }

    pub fn restore_template_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.restore_item_from_trash("template", |store| store.restore_template_from_trash(id))
    }

    pub fn restore_signature_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.restore_item_from_trash("signature", |store| store.restore_signature_from_trash(id))
    }

    pub fn permanently_delete_draft_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.permanently_delete_item_from_trash("draft", |store| {
            store.permanently_delete_draft_from_trash(id)
        })
    }

    pub fn permanently_delete_template_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.permanently_delete_item_from_trash("template", |store| {
            store.permanently_delete_template_from_trash(id)
        })
    }

    pub fn permanently_delete_signature_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.permanently_delete_item_from_trash("signature", |store| {
            store.permanently_delete_signature_from_trash(id)
        })
    }

    pub fn empty_trash(&self) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.empty_trash();
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.empty",
                    module: "trash",
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
                    event_name: "trash.empty",
                    module: "trash",
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

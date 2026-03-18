use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::store::{SaveDraftResult, SaveSignatureResult, SaveTemplateResult, StoreSnapshot};

use super::{
    context::{elapsed_millis, merge_context, snapshot_counts_context, trash_kind_context},
    AppResult, AppState,
};

impl AppState {
    pub fn restore_draft_from_trash(&self, id: &str) -> AppResult<SaveDraftResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let restored_draft = store
                .restore_draft_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store(&store)?;

            let snapshot_context = snapshot_counts_context(&store);

            Ok((
                SaveDraftResult {
                    draft: restored_draft.draft,
                    draft_history: restored_draft.history,
                },
                snapshot_context,
            ))
        })();

        match result {
            Ok((restored_draft, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(trash_kind_context("draft"), snapshot_context),
                });
                Ok(restored_draft)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("TRASH_ITEM_NOT_FOUND"),
                    safe_context: trash_kind_context("draft"),
                });
                Err(error)
            }
        }
    }

    pub fn restore_template_from_trash(&self, id: &str) -> AppResult<SaveTemplateResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let template = store
                .restore_template_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store(&store)?;

            let snapshot_context = snapshot_counts_context(&store);

            Ok((SaveTemplateResult { template }, snapshot_context))
        })();

        match result {
            Ok((restored_template, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(trash_kind_context("template"), snapshot_context),
                });
                Ok(restored_template)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("TRASH_ITEM_NOT_FOUND"),
                    safe_context: trash_kind_context("template"),
                });
                Err(error)
            }
        }
    }

    pub fn restore_signature_from_trash(&self, id: &str) -> AppResult<SaveSignatureResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            store.restore_signature_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store(&store)?;

            let snapshot_context = snapshot_counts_context(&store);
            let signatures = store.signatures.clone();

            Ok((SaveSignatureResult { signatures }, snapshot_context))
        })();

        match result {
            Ok((restored_signature, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(trash_kind_context("signature"), snapshot_context),
                });
                Ok(restored_signature)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("TRASH_ITEM_NOT_FOUND"),
                    safe_context: trash_kind_context("signature"),
                });
                Err(error)
            }
        }
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

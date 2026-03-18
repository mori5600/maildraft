use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::{
    drafts::DraftInput,
    store::{SaveDraftResult, StoreSnapshot},
};

use super::{
    context::{draft_context, elapsed_millis, merge_context, snapshot_counts_context, timestamp},
    AppResult, AppState,
};

impl AppState {
    pub fn save_draft(&self, input: DraftInput) -> AppResult<SaveDraftResult> {
        let started_at = Instant::now();
        let safe_context = draft_context(&input);
        let draft_id = input.id.clone();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            store.upsert_draft(input, &timestamp);
            store.ensure_consistency();
            self.persist_locked_store(&store)?;

            let draft = store
                .drafts
                .iter()
                .find(|draft| draft.id == draft_id)
                .cloned()
                .ok_or_else(|| "保存した下書きが見つかりませんでした。".to_string())?;
            let draft_history = store
                .draft_history
                .iter()
                .filter(|entry| entry.draft_id == draft_id)
                .cloned()
                .collect();
            let snapshot_context = snapshot_counts_context(&store);

            Ok((SaveDraftResult { draft, draft_history }, snapshot_context))
        })();

        match result {
            Ok((saved_draft, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.save",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_context),
                });
                Ok(saved_draft)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "draft.save",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    pub fn delete_draft(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.delete_draft(id, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.trash",
                    module: "drafts",
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
                    event_name: "draft.trash",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }

    pub fn restore_draft_history(
        &self,
        draft_id: &str,
        history_id: &str,
    ) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        if !store.restore_draft_history(draft_id, history_id, &timestamp()) {
            self.log_event(LogEntry {
                level: LogLevel::Error,
                event_name: "draft.restore_history",
                module: "drafts",
                result: "failure",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: Some("DRAFT_HISTORY_NOT_FOUND"),
                safe_context: Map::new(),
            });
            return Err("指定した履歴が見つかりませんでした。".to_string());
        }

        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "draft.restore_history",
            module: "drafts",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: snapshot_counts_context(&snapshot),
        });

        Ok(snapshot)
    }
}

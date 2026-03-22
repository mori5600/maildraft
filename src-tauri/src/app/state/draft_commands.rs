use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::app::validation::validate_draft_input;
use crate::modules::{
    drafts::DraftInput,
    store::{DeleteDraftResult, SaveDraftResult, StoreSnapshot},
};

use super::{
    context::{draft_context, elapsed_millis, merge_context, snapshot_counts_context, timestamp},
    AppResult, AppState,
};

impl AppState {
    fn collect_saved_draft_result(
        store: &StoreSnapshot,
        draft_id: &str,
    ) -> AppResult<SaveDraftResult> {
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

        Ok(SaveDraftResult {
            draft,
            draft_history,
        })
    }

    /// Persists a draft, records the save attempt, and returns the saved draft with its history.
    ///
    /// The compact payload avoids cloning the full store after every save.
    ///
    /// # Errors
    ///
    /// Returns an error if the store lock, persistence step, or saved draft lookup fails.
    pub fn save_draft(&self, input: DraftInput) -> AppResult<SaveDraftResult> {
        let started_at = Instant::now();
        let safe_context = draft_context(&input);
        let draft_id = input.id.clone();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            validate_draft_input(&input, &store)?;
            let previous = store.clone();
            store.upsert_draft(input, &timestamp);
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;
            let saved_draft = Self::collect_saved_draft_result(&store, &draft_id)?;
            let snapshot_context = snapshot_counts_context(&store);

            Ok((saved_draft, snapshot_context))
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

    /// Moves one draft to trash and persists the updated store.
    ///
    /// The response returns only the trashed draft. Active draft history remains available through
    /// the existing snapshot until the frontend applies the trash mutation.
    ///
    /// # Errors
    ///
    /// Returns an error if the draft does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn delete_draft(&self, id: &str) -> AppResult<DeleteDraftResult> {
        let started_at = Instant::now();

        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let trashed_draft = store
                .delete_draft(id, &timestamp)
                .ok_or_else(|| "指定した下書きが見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);

            Ok((DeleteDraftResult { trashed_draft }, snapshot_context))
        })();

        match result {
            Ok((deleted_draft, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.trash",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(deleted_draft)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "draft.trash",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("DRAFT_NOT_FOUND"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }

    /// Replaces the current draft contents with one saved history entry and persists the result.
    ///
    /// The response mirrors `save_draft`: it returns the restored draft plus the active history for
    /// that draft so the frontend can patch the current snapshot without a full reload.
    ///
    /// # Errors
    ///
    /// Returns an error if the history entry does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn restore_draft_history(
        &self,
        draft_id: &str,
        history_id: &str,
    ) -> AppResult<SaveDraftResult> {
        let started_at = Instant::now();
        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            if !store.restore_draft_history(draft_id, history_id, &timestamp()) {
                return Err("指定した履歴が見つかりませんでした。".to_string());
            }

            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;
            let restored_draft = Self::collect_saved_draft_result(&store, draft_id)?;
            let snapshot_context = snapshot_counts_context(&store);

            Ok((restored_draft, snapshot_context))
        })();

        match result {
            Ok((restored_draft, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.restore_history",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(restored_draft)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "draft.restore_history",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("DRAFT_HISTORY_NOT_FOUND"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }
}

use std::time::Instant;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::memo::{Memo, MemoInput};
use crate::modules::store::DeleteMemoResult;

use super::{
    context::{elapsed_millis, memo_context, merge_context, snapshot_counts_context, timestamp},
    AppResult, AppState,
};

impl AppState {
    /// Saves one memo document and persists the updated store.
    ///
    /// # Errors
    ///
    /// Returns an error if the store lock cannot be acquired or persistence fails.
    pub fn save_memo(&self, input: MemoInput) -> AppResult<Memo> {
        let started_at = Instant::now();
        let safe_context = memo_context(&input);
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let memo = store.upsert_memo(input, &timestamp);
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);
            Ok((memo, snapshot_context))
        })();

        match result {
            Ok((memo, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "memo.save",
                    module: "memo",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_context),
                });
                Ok(memo)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "memo.save",
                    module: "memo",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    /// Deletes one memo document and persists the updated store.
    ///
    /// # Errors
    ///
    /// Returns an error if the memo does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn delete_memo(&self, id: &str) -> AppResult<DeleteMemoResult> {
        let started_at = Instant::now();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let trashed_memo = store
                .delete_memo(id, &timestamp)
                .ok_or_else(|| "指定したメモが見つかりませんでした。".to_string())?;

            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);
            Ok((DeleteMemoResult { trashed_memo }, snapshot_context))
        })();

        match result {
            Ok((deleted_memo, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "memo.delete",
                    module: "memo",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(deleted_memo)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "memo.delete",
                    module: "memo",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("MEMO_NOT_FOUND"),
                    safe_context: serde_json::Map::new(),
                });
                Err(error)
            }
        }
    }
}

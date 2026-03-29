use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::app::validation::validate_block_input;
use crate::modules::{
    blocks::ContentBlockInput,
    store::{DeleteBlockResult, SaveBlockResult},
};

use super::{
    context::{block_context, elapsed_millis, merge_context, snapshot_counts_context, timestamp},
    AppResult, AppState,
};

impl AppState {
    pub fn save_block(&self, input: ContentBlockInput) -> AppResult<SaveBlockResult> {
        let input = input.normalized();
        let started_at = Instant::now();
        let safe_context = block_context(&input);
        let timestamp = timestamp();

        let result = (|| {
            validate_block_input(&input)?;
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let block = store.upsert_block(input, &timestamp);
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            Ok((SaveBlockResult { block }, snapshot_counts_context(&store)))
        })();

        match result {
            Ok((saved_block, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "block.save",
                    module: "blocks",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_context),
                });
                Ok(saved_block)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "block.save",
                    module: "blocks",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    pub fn delete_block(&self, id: &str) -> AppResult<DeleteBlockResult> {
        let started_at = Instant::now();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let trashed_block = store
                .delete_block(id, &timestamp)
                .ok_or_else(|| "指定した文面ブロックが見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            Ok((DeleteBlockResult { trashed_block }, snapshot_counts_context(&store)))
        })();

        match result {
            Ok((deleted_block, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "block.trash",
                    module: "blocks",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(deleted_block)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "block.trash",
                    module: "blocks",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("BLOCK_NOT_FOUND"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }
}

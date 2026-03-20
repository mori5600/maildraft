use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::{
    signatures::SignatureInput,
    store::{DeleteSignatureResult, SaveSignatureResult},
};

use super::{
    context::{
        elapsed_millis, merge_context, signature_context, snapshot_counts_context, timestamp,
    },
    AppResult, AppState,
};

impl AppState {
    /// Saves one signature and persists the updated store.
    ///
    /// The response returns the full active signature list because consistency fixes may update
    /// default-signature state beyond the edited item.
    ///
    /// # Errors
    ///
    /// Returns an error if the store lock cannot be acquired or persistence fails.
    pub fn save_signature(&self, input: SignatureInput) -> AppResult<SaveSignatureResult> {
        let started_at = Instant::now();
        let safe_context = signature_context(&input);
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            store.upsert_signature(input, &timestamp);
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);
            let signatures = store.signatures.clone();

            Ok((SaveSignatureResult { signatures }, snapshot_context))
        })();

        match result {
            Ok((saved_signature, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "signature.save",
                    module: "signatures",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_context),
                });
                Ok(saved_signature)
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

    /// Moves one signature to trash and persists the updated store.
    ///
    /// The response includes both the trashed signature and the remaining active signatures because
    /// consistency fixes may reassign default-signature state.
    ///
    /// # Errors
    ///
    /// Returns an error if the signature does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn delete_signature(&self, id: &str) -> AppResult<DeleteSignatureResult> {
        let started_at = Instant::now();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let trashed_signature = store
                .delete_signature(id, &timestamp)
                .ok_or_else(|| "指定した署名が見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);
            let signatures = store.signatures.clone();

            Ok((
                DeleteSignatureResult {
                    signatures,
                    trashed_signature,
                },
                snapshot_context,
            ))
        })();

        match result {
            Ok((deleted_signature, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "signature.trash",
                    module: "signatures",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(deleted_signature)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "signature.trash",
                    module: "signatures",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("SIGNATURE_NOT_FOUND"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }
}

use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::app::validation::validate_template_input;
use crate::modules::{
    store::{DeleteTemplateResult, SaveTemplateResult},
    templates::TemplateInput,
};

use super::{
    context::{
        elapsed_millis, merge_context, snapshot_counts_context, template_context, timestamp,
    },
    AppResult, AppState,
};

impl AppState {
    /// Saves one template and persists the updated store.
    ///
    /// The return payload contains only the saved template. Frontend callers patch it into the
    /// current snapshot instead of replacing the full store.
    ///
    /// # Errors
    ///
    /// Returns an error if the store lock cannot be acquired, persistence fails, or the saved
    /// template cannot be resolved after consistency fixes.
    pub fn save_template(&self, input: TemplateInput) -> AppResult<SaveTemplateResult> {
        let input = input.normalized();
        let started_at = Instant::now();
        let safe_context = template_context(&input);
        let template_id = input.id.clone();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            validate_template_input(&input, &store)?;
            let previous = store.clone();
            store.upsert_template(input, &timestamp);
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let template = store
                .templates
                .iter()
                .find(|template| template.id == template_id)
                .cloned()
                .ok_or_else(|| "保存したテンプレートが見つかりませんでした。".to_string())?;
            let snapshot_context = snapshot_counts_context(&store);

            Ok((SaveTemplateResult { template }, snapshot_context))
        })();

        match result {
            Ok((saved_template, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.save",
                    module: "templates",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_context),
                });
                Ok(saved_template)
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

    /// Moves one template to trash and persists the updated store.
    ///
    /// The return payload contains only the trashed template. Consistency fixes may still rewrite
    /// related draft references before persistence.
    ///
    /// # Errors
    ///
    /// Returns an error if the template does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn delete_template(&self, id: &str) -> AppResult<DeleteTemplateResult> {
        let started_at = Instant::now();
        let timestamp = timestamp();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let trashed_template = store
                .delete_template(id, &timestamp)
                .ok_or_else(|| "指定したテンプレートが見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);

            Ok((DeleteTemplateResult { trashed_template }, snapshot_context))
        })();

        match result {
            Ok((deleted_template, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.trash",
                    module: "templates",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(deleted_template)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "template.trash",
                    module: "templates",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("TEMPLATE_NOT_FOUND"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }
}

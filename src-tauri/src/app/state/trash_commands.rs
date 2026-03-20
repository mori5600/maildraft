use std::time::Instant;

use serde_json::Map;

use crate::app::logging::{LogEntry, LogLevel};
use crate::modules::memo::Memo;
use crate::modules::store::{
    SaveDraftResult, SaveSignatureResult, SaveTemplateResult, TrashMutationResult,
};

use super::{
    context::{elapsed_millis, merge_context, snapshot_counts_context, trash_kind_context},
    AppResult, AppState,
};

impl AppState {
    /// Restores one draft from trash and persists the updated store.
    ///
    /// The response mirrors `save_draft`: it returns the restored draft plus the active history for
    /// that draft so the frontend can patch the current snapshot without a full reload.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn restore_draft_from_trash(&self, id: &str) -> AppResult<SaveDraftResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            store
                .restore_draft_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);
            let draft = store
                .drafts
                .iter()
                .find(|draft| draft.id == id)
                .cloned()
                .ok_or_else(|| "復元した下書きが見つかりませんでした。".to_string())?;
            let draft_history = store
                .draft_history
                .iter()
                .filter(|entry| entry.draft_id == id)
                .cloned()
                .collect();

            Ok((
                SaveDraftResult {
                    draft,
                    draft_history,
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

    /// Restores one template from trash and persists the updated store.
    ///
    /// The response returns only the restored template. Consistency fixes may still rewrite draft
    /// references before persistence.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn restore_template_from_trash(&self, id: &str) -> AppResult<SaveTemplateResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            store
                .restore_template_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            let snapshot_context = snapshot_counts_context(&store);
            let template = store
                .templates
                .iter()
                .find(|template| template.id == id)
                .cloned()
                .ok_or_else(|| "復元したテンプレートが見つかりませんでした。".to_string())?;

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

    /// Restores one signature from trash and persists the updated store.
    ///
    /// The response returns the full active signature list because consistency fixes may update
    /// default-signature state beyond the restored item.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn restore_signature_from_trash(&self, id: &str) -> AppResult<SaveSignatureResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            store
                .restore_signature_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

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

    /// Restores one memo from trash and persists the updated store.
    ///
    /// The response returns only the restored memo because memo restore does not rewrite
    /// unrelated active collections.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn restore_memo_from_trash(&self, id: &str) -> AppResult<Memo> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let memo = store
                .restore_memo_from_trash(id)
                .ok_or_else(|| "指定した項目がゴミ箱に見つかりませんでした。".to_string())?;
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            Ok((memo, snapshot_counts_context(&store)))
        })();

        match result {
            Ok((restored_memo, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(trash_kind_context("memo"), snapshot_context),
                });
                Ok(restored_memo)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "trash.restore",
                    module: "trash",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("TRASH_ITEM_NOT_FOUND"),
                    safe_context: trash_kind_context("memo"),
                });
                Err(error)
            }
        }
    }

    /// Permanently deletes one trashed draft and persists the updated store.
    ///
    /// The returned mutation updates only the trash collection because removing a trashed draft
    /// does not rewrite active drafts, templates, or history.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn permanently_delete_draft_from_trash(&self, id: &str) -> AppResult<TrashMutationResult> {
        self.permanently_delete_item_from_trash(
            "draft",
            |store| store.permanently_delete_draft_from_trash(id),
            |store| TrashMutationResult {
                drafts: None,
                draft_history: None,
                templates: None,
                trash: store.trash.clone(),
            },
        )
    }

    /// Permanently deletes one trashed template and persists the updated store.
    ///
    /// The returned mutation includes active drafts and draft history because consistency fixes may
    /// clear template references in active drafts.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn permanently_delete_template_from_trash(
        &self,
        id: &str,
    ) -> AppResult<TrashMutationResult> {
        self.permanently_delete_item_from_trash(
            "template",
            |store| store.permanently_delete_template_from_trash(id),
            |store| TrashMutationResult {
                drafts: Some(store.drafts.clone()),
                draft_history: Some(store.draft_history.clone()),
                templates: None,
                trash: store.trash.clone(),
            },
        )
    }

    /// Permanently deletes one trashed signature and persists the updated store.
    ///
    /// The returned mutation includes active drafts, draft history, and templates because
    /// consistency fixes may clear signature references and recalculate default-signature state.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn permanently_delete_signature_from_trash(
        &self,
        id: &str,
    ) -> AppResult<TrashMutationResult> {
        self.permanently_delete_item_from_trash(
            "signature",
            |store| store.permanently_delete_signature_from_trash(id),
            |store| TrashMutationResult {
                drafts: Some(store.drafts.clone()),
                draft_history: Some(store.draft_history.clone()),
                templates: Some(store.templates.clone()),
                trash: store.trash.clone(),
            },
        )
    }

    /// Permanently deletes one trashed memo and persists the updated store.
    ///
    /// The returned mutation updates only the trash collection because removing a trashed memo
    /// does not rewrite active drafts, templates, signatures, or memos.
    ///
    /// # Errors
    ///
    /// Returns an error if the trash item does not exist, the store lock cannot be acquired, or
    /// persistence fails.
    pub fn permanently_delete_memo_from_trash(&self, id: &str) -> AppResult<TrashMutationResult> {
        self.permanently_delete_item_from_trash(
            "memo",
            |store| store.permanently_delete_memo_from_trash(id),
            |store| TrashMutationResult {
                drafts: None,
                draft_history: None,
                templates: None,
                trash: store.trash.clone(),
            },
        )
    }

    /// Permanently deletes all trash items and persists the updated store.
    ///
    /// Optional fields in the returned mutation are present only when emptying trash rewrites the
    /// corresponding active collections after consistency fixes.
    ///
    /// # Errors
    ///
    /// Returns an error if the store lock cannot be acquired or persistence fails.
    pub fn empty_trash(&self) -> AppResult<TrashMutationResult> {
        let started_at = Instant::now();

        let result = (|| {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            let previous = store.clone();
            let had_trashed_templates = !store.trash.templates.is_empty();
            let had_trashed_signatures = !store.trash.signatures.is_empty();

            store.empty_trash();
            store.ensure_consistency();
            self.persist_locked_store_with_rollback(&mut store, previous)?;

            Ok((
                TrashMutationResult {
                    drafts: if had_trashed_templates || had_trashed_signatures {
                        Some(store.drafts.clone())
                    } else {
                        None
                    },
                    draft_history: if had_trashed_templates || had_trashed_signatures {
                        Some(store.draft_history.clone())
                    } else {
                        None
                    },
                    templates: if had_trashed_signatures {
                        Some(store.templates.clone())
                    } else {
                        None
                    },
                    trash: store.trash.clone(),
                },
                snapshot_counts_context(&store),
            ))
        })();

        match result {
            Ok((mutation, snapshot_context)) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.empty",
                    module: "trash",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_context,
                });
                Ok(mutation)
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

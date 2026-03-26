use std::time::Instant;

use crate::app::{
    logging::{LogEntry, LogLevel},
    settings::{
        AppSettings, EditorSettingsSnapshot, LoggingSettings, LoggingSettingsSnapshot,
        ProofreadingSettingsSnapshot,
    },
};
use crate::modules::store::StoreSnapshot;

use super::{
    context::{elapsed_millis, merge_context, snapshot_counts_context, trash_kind_context},
    AppResult, AppState,
};

impl AppState {
    pub(super) fn persist_current_state(&self) -> AppResult<()> {
        let store = self.store.lock().map_err(|error| error.to_string())?;
        let settings = self.settings.lock().map_err(|error| error.to_string())?;
        self.persist_locked_state(&store, &settings)
    }

    pub(super) fn persist_locked_store(&self, store: &StoreSnapshot) -> AppResult<()> {
        self.repository.save_store_snapshot(store)
    }

    pub(super) fn persist_locked_settings(&self, settings: &AppSettings) -> AppResult<()> {
        self.repository.save_app_settings(settings)
    }

    pub(super) fn persist_locked_state(
        &self,
        store: &StoreSnapshot,
        settings: &AppSettings,
    ) -> AppResult<()> {
        self.repository.save_state(store, settings)
    }

    pub(super) fn persist_locked_store_with_rollback(
        &self,
        store: &mut StoreSnapshot,
        previous: StoreSnapshot,
    ) -> AppResult<()> {
        if let Err(error) = self.persist_locked_store(store) {
            *store = previous;
            return Err(error);
        }

        Ok(())
    }

    pub(super) fn persist_locked_settings_with_rollback(
        &self,
        settings: &mut AppSettings,
        previous: AppSettings,
    ) -> AppResult<()> {
        if let Err(error) = self.persist_locked_settings(settings) {
            *settings = previous;
            return Err(error);
        }

        Ok(())
    }

    pub(super) fn restore_app_settings(&self, snapshot: &AppSettings) -> AppResult<()> {
        let mut settings = self.settings.lock().map_err(|error| error.to_string())?;
        *settings = snapshot.clone();
        self.persist_locked_settings(&settings)
    }

    pub(super) fn logging_settings_snapshot(&self) -> AppResult<LoggingSettingsSnapshot> {
        let logging_settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.logging.clone()
        };

        self.logger
            .prune_expired_logs(logging_settings.retention_days)
            .map_err(|error| error.to_string())?;

        self.logger_snapshot(&logging_settings)
    }

    pub(super) fn proofreading_settings_snapshot(&self) -> AppResult<ProofreadingSettingsSnapshot> {
        let proofreading_settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.proofreading.clone()
        };

        Ok(ProofreadingSettingsSnapshot::from(&proofreading_settings))
    }

    pub(super) fn editor_settings_snapshot(&self) -> AppResult<EditorSettingsSnapshot> {
        let editor_settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.editor.clone()
        };

        Ok(EditorSettingsSnapshot::from(&editor_settings))
    }

    pub(super) fn logger_snapshot(
        &self,
        logging_settings: &LoggingSettings,
    ) -> AppResult<LoggingSettingsSnapshot> {
        self.logger
            .snapshot(logging_settings)
            .map_err(|error| error.to_string())
    }

    pub(super) fn current_logging_settings(&self) -> Option<LoggingSettings> {
        let settings = self.settings.lock().ok()?;
        Some(settings.logging.clone())
    }

    pub(super) fn log_event(&self, entry: LogEntry) {
        if let Some(logging_settings) = self.current_logging_settings() {
            self.log_event_with_settings(&logging_settings, entry);
        }
    }

    pub(super) fn log_event_with_settings(
        &self,
        logging_settings: &LoggingSettings,
        entry: LogEntry,
    ) {
        let _ = self.logger.record(logging_settings, entry);
    }

    pub(super) fn permanently_delete_item_from_trash<F, B, R>(
        &self,
        kind: &str,
        mutator: F,
        build_result: B,
    ) -> AppResult<R>
    where
        F: FnOnce(&mut StoreSnapshot) -> bool,
        B: FnOnce(&StoreSnapshot) -> R,
    {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        let previous = store.clone();

        if !mutator(&mut store) {
            self.log_event(LogEntry {
                level: LogLevel::Error,
                event_name: "trash.delete_permanently",
                module: "trash",
                result: "failure",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: Some("TRASH_ITEM_NOT_FOUND"),
                safe_context: trash_kind_context(kind),
            });
            return Err("指定した項目がゴミ箱に見つかりませんでした。".to_string());
        }

        store.ensure_consistency();
        self.persist_locked_store_with_rollback(&mut store, previous)?;
        let safe_context = merge_context(trash_kind_context(kind), snapshot_counts_context(&store));
        let result = build_result(&store);
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "trash.delete_permanently",
            module: "trash",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context,
        });

        Ok(result)
    }
}

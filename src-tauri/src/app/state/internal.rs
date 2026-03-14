use std::time::Instant;

use crate::app::{
    logging::{LogEntry, LogLevel},
    settings::{AppSettings, LoggingSettings, LoggingSettingsSnapshot},
    storage::{write_app_settings, write_store_snapshot},
};
use crate::modules::store::StoreSnapshot;

use super::{
    context::{elapsed_millis, merge_context, snapshot_counts_context, trash_kind_context},
    AppResult, AppState,
};

impl AppState {
    pub(super) fn mutate_store<F>(&self, mutator: F) -> AppResult<StoreSnapshot>
    where
        F: FnOnce(&mut StoreSnapshot),
    {
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        mutator(&mut store);
        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        Ok(store.clone())
    }

    pub(super) fn persist_current_store(&self) -> AppResult<()> {
        let store = self.store.lock().map_err(|error| error.to_string())?;
        self.persist_locked_store(&store)
    }

    pub(super) fn persist_current_settings(&self) -> AppResult<()> {
        let settings = self.settings.lock().map_err(|error| error.to_string())?;
        self.persist_locked_settings(&settings)
    }

    pub(super) fn persist_locked_store(&self, store: &StoreSnapshot) -> AppResult<()> {
        write_store_snapshot(&self.store_path, store)
    }

    pub(super) fn persist_locked_settings(&self, settings: &AppSettings) -> AppResult<()> {
        write_app_settings(&self.settings_path, settings)
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

    pub(super) fn restore_item_from_trash<F>(
        &self,
        kind: &str,
        mutator: F,
    ) -> AppResult<StoreSnapshot>
    where
        F: FnOnce(&mut StoreSnapshot) -> bool,
    {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;

        if !mutator(&mut store) {
            self.log_event(LogEntry {
                level: LogLevel::Error,
                event_name: "trash.restore",
                module: "trash",
                result: "failure",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: Some("TRASH_ITEM_NOT_FOUND"),
                safe_context: trash_kind_context(kind),
            });
            return Err("指定した項目がゴミ箱に見つかりませんでした。".to_string());
        }

        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "trash.restore",
            module: "trash",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: merge_context(
                trash_kind_context(kind),
                snapshot_counts_context(&snapshot),
            ),
        });

        Ok(snapshot)
    }

    pub(super) fn permanently_delete_item_from_trash<F>(
        &self,
        kind: &str,
        mutator: F,
    ) -> AppResult<StoreSnapshot>
    where
        F: FnOnce(&mut StoreSnapshot) -> bool,
    {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;

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
        self.persist_locked_store(&store)?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "trash.delete_permanently",
            module: "trash",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: merge_context(
                trash_kind_context(kind),
                snapshot_counts_context(&snapshot),
            ),
        });

        Ok(snapshot)
    }
}

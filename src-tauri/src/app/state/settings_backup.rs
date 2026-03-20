use std::{fs, time::Instant};

use crate::app::{
    backup::{decode_backup_document, BackupDocument, ImportedBackupSnapshot},
    logging::{LogEntry, LogEntrySnapshot, LogLevel},
    settings::{LoggingSettingsInput, LoggingSettingsSnapshot},
};

use super::{
    context::{elapsed_millis, logging_settings_context, snapshot_counts_context},
    AppResult, AppState,
};

fn combine_rollback_error(primary: String, label: &str, rollback: String) -> String {
    format!("{primary} / {label}: {rollback}")
}

impl AppState {
    /// Returns the current logging settings snapshot.
    ///
    /// This does not touch the store or log files.
    pub fn load_logging_settings(&self) -> AppResult<LoggingSettingsSnapshot> {
        self.logging_settings_snapshot()
    }

    /// Exports the current store snapshot and app settings to a backup file.
    ///
    /// The backup is normalized before serialization so the written document reflects the same
    /// consistency rules as the running store.
    ///
    /// # Errors
    ///
    /// Returns an error if the store or settings lock cannot be acquired, serialization fails, or
    /// the target path cannot be written.
    pub fn export_backup(&self, path: &str) -> AppResult<String> {
        let started_at = Instant::now();
        let snapshot = {
            let store = self.store.lock().map_err(|error| error.to_string())?;
            let mut snapshot = store.clone();
            snapshot.ensure_consistency();
            snapshot
        };
        let settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.clone().normalized()
        };
        let document = BackupDocument::from_state(snapshot.clone(), settings);
        let content = serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?;

        match fs::write(path, content) {
            Ok(()) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "backup.export",
                    module: "backup",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Ok(path.to_string())
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "backup.export",
                    module: "backup",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("BACKUP_EXPORT_FAILED"),
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Err(error.to_string())
            }
        }
    }

    /// Imports a backup file, replaces the in-memory store and settings, and persists both.
    ///
    /// This also prunes retained logs against the imported retention policy before returning the
    /// refreshed logging snapshot.
    ///
    /// # Errors
    ///
    /// Returns an error if the file cannot be read, the document is invalid, locks cannot be
    /// acquired, persistence fails, or log pruning fails.
    pub fn import_backup(&self, path: &str) -> AppResult<ImportedBackupSnapshot> {
        let started_at = Instant::now();
        let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
        let document = decode_backup_document(&content)?;
        let (mut snapshot, settings) = document.into_state()?;
        snapshot.ensure_consistency();
        let previous_store = {
            let store = self.store.lock().map_err(|error| error.to_string())?;
            store.clone()
        };
        let previous_settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.clone()
        };

        {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            *store = snapshot.clone();
            self.persist_locked_store_with_rollback(&mut store, previous_store.clone())?;
        }

        {
            let mut app_settings = self.settings.lock().map_err(|error| error.to_string())?;
            *app_settings = settings.clone();
            if let Err(error) = self
                .persist_locked_settings_with_rollback(&mut app_settings, previous_settings.clone())
            {
                return match self.restore_store_snapshot(&previous_store) {
                    Ok(()) => Err(error),
                    Err(rollback_error) => Err(combine_rollback_error(
                        error,
                        "store rollback failed",
                        rollback_error,
                    )),
                };
            }
        }

        if let Err(error) = self
            .logger
            .prune_expired_logs(settings.logging.retention_days)
            .map_err(|error| error.to_string())
        {
            let rollback_result = self
                .restore_store_snapshot(&previous_store)
                .and_then(|()| self.restore_app_settings(&previous_settings));
            return match rollback_result {
                Ok(()) => Err(error),
                Err(rollback_error) => Err(combine_rollback_error(
                    error,
                    "state rollback failed",
                    rollback_error,
                )),
            };
        }

        let logging_settings = self.logger_snapshot(&settings.logging)?;

        self.log_event_with_settings(
            &settings.logging,
            LogEntry {
                level: LogLevel::Info,
                event_name: "backup.import",
                module: "backup",
                result: "success",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: None,
                safe_context: snapshot_counts_context(&snapshot),
            },
        );

        Ok(ImportedBackupSnapshot {
            snapshot,
            logging_settings,
        })
    }

    /// Loads recent logs with a bounded item count.
    ///
    /// The requested limit is clamped to the range `1..=200` to keep the UI request predictable.
    ///
    /// # Errors
    ///
    /// Returns an error if the settings lock cannot be acquired or log loading fails.
    pub fn load_recent_logs(&self, limit: Option<usize>) -> AppResult<Vec<LogEntrySnapshot>> {
        let logging_settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.logging.clone()
        };
        let limit = limit.unwrap_or(80).clamp(1, 200);

        self.logger
            .load_recent(logging_settings.retention_days, limit)
            .map_err(|error| error.to_string())
    }

    /// Saves logging settings and immediately applies the new retention policy.
    ///
    /// Persisted settings take effect before expired log files are pruned.
    ///
    /// # Errors
    ///
    /// Returns an error if the settings lock cannot be acquired, persistence fails, log pruning
    /// fails, or the refreshed snapshot cannot be loaded.
    pub fn save_logging_settings(
        &self,
        input: LoggingSettingsInput,
    ) -> AppResult<LoggingSettingsSnapshot> {
        let started_at = Instant::now();
        let next_settings = input.into_settings();
        let previous_settings = {
            let mut settings = self.settings.lock().map_err(|error| error.to_string())?;
            let previous = settings.clone();

            settings.logging = next_settings.clone();
            self.persist_locked_settings_with_rollback(&mut settings, previous.clone())?;
            previous
        };

        if let Err(error) = self
            .logger
            .prune_expired_logs(next_settings.retention_days)
            .map_err(|error| error.to_string())
        {
            return match self.restore_app_settings(&previous_settings) {
                Ok(()) => Err(error),
                Err(rollback_error) => Err(combine_rollback_error(
                    error,
                    "settings rollback failed",
                    rollback_error,
                )),
            };
        }

        self.log_event_with_settings(
            &next_settings,
            LogEntry {
                level: LogLevel::Info,
                event_name: "settings.logging_saved",
                module: "settings",
                result: "success",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: None,
                safe_context: logging_settings_context(&next_settings),
            },
        );

        self.logger_snapshot(&next_settings)
    }

    /// Deletes retained log files and returns the current logging settings snapshot.
    ///
    /// # Errors
    ///
    /// Returns an error if log deletion fails or the refreshed settings snapshot cannot be loaded.
    pub fn clear_logs(&self) -> AppResult<LoggingSettingsSnapshot> {
        self.logger.clear().map_err(|error| error.to_string())?;
        self.logging_settings_snapshot()
    }
}

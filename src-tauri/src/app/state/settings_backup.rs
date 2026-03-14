use std::{fs, time::Instant};

use crate::app::{
    backup::{BackupDocument, ImportedBackupSnapshot},
    logging::{LogEntry, LogEntrySnapshot, LogLevel},
    settings::{LoggingSettingsInput, LoggingSettingsSnapshot},
};

use super::{
    context::{elapsed_millis, logging_settings_context, snapshot_counts_context},
    AppResult, AppState,
};

impl AppState {
    pub fn load_logging_settings(&self) -> AppResult<LoggingSettingsSnapshot> {
        self.logging_settings_snapshot()
    }

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

    pub fn import_backup(&self, path: &str) -> AppResult<ImportedBackupSnapshot> {
        let started_at = Instant::now();
        let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
        let document =
            serde_json::from_str::<BackupDocument>(&content).map_err(|error| error.to_string())?;
        let (mut snapshot, settings) = document.into_state()?;
        snapshot.ensure_consistency();

        {
            let mut store = self.store.lock().map_err(|error| error.to_string())?;
            *store = snapshot.clone();
            self.persist_locked_store(&store)?;
        }

        {
            let mut app_settings = self.settings.lock().map_err(|error| error.to_string())?;
            *app_settings = settings.clone();
            self.persist_locked_settings(&app_settings)?;
        }

        self.logger
            .prune_expired_logs(settings.logging.retention_days)
            .map_err(|error| error.to_string())?;

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

    pub fn save_logging_settings(
        &self,
        input: LoggingSettingsInput,
    ) -> AppResult<LoggingSettingsSnapshot> {
        let started_at = Instant::now();
        let next_settings = input.into_settings();

        {
            let mut settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.logging = next_settings.clone();
            self.persist_locked_settings(&settings)?;
        }

        self.logger
            .prune_expired_logs(next_settings.retention_days)
            .map_err(|error| error.to_string())?;

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

    pub fn clear_logs(&self) -> AppResult<LoggingSettingsSnapshot> {
        self.logger.clear().map_err(|error| error.to_string())?;
        self.logging_settings_snapshot()
    }
}

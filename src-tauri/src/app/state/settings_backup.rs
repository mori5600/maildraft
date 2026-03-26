use std::{fs, path::PathBuf, time::Instant};

use crate::app::{
    backup::{decode_backup_document, BackupDocument, ImportedBackupSnapshot},
    logging::{LogEntry, LogEntrySnapshot, LogLevel},
    settings::{
        EditorSettingsInput, EditorSettingsSnapshot, LoggingSettingsInput, LoggingSettingsSnapshot,
        ProofreadingSettingsInput, ProofreadingSettingsSnapshot,
    },
    validation::{
        ensure_content_size, read_text_file_with_limit, validate_export_backup_path,
        validate_import_backup_path, validate_proofreading_settings_input, validate_store_snapshot,
        MAX_BACKUP_FILE_BYTES,
    },
};

use super::{
    context::{
        editor_settings_context, elapsed_millis, logging_settings_context,
        proofreading_settings_context,
        snapshot_counts_context,
    },
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

    /// Returns the current editor settings snapshot.
    pub fn load_editor_settings(&self) -> AppResult<EditorSettingsSnapshot> {
        self.editor_settings_snapshot()
    }

    /// Returns the current proofreading settings snapshot.
    pub fn load_proofreading_settings(&self) -> AppResult<ProofreadingSettingsSnapshot> {
        self.proofreading_settings_snapshot()
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
        let protected_paths = self.protected_backup_paths();
        let protected_path_refs = protected_paths
            .iter()
            .map(PathBuf::as_path)
            .collect::<Vec<_>>();
        let export_path = validate_export_backup_path(path, &protected_path_refs)?;
        let persisted_state = self.repository.load_state()?;
        let mut snapshot = persisted_state.snapshot;
        snapshot.ensure_consistency();
        validate_store_snapshot(&snapshot)?;
        let settings = persisted_state.settings.normalized();
        let document = BackupDocument::from_state(snapshot.clone(), settings);
        let content = serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?;
        ensure_content_size(
            &content,
            MAX_BACKUP_FILE_BYTES,
            "バックアップファイルが大きすぎるため書き出せませんでした。",
        )?;

        match fs::write(&export_path, content) {
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
                Ok(export_path.display().to_string())
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
        let import_path = validate_import_backup_path(path)?;
        let content = read_text_file_with_limit(
            &import_path,
            MAX_BACKUP_FILE_BYTES,
            "バックアップファイルが大きすぎます。",
        )?;
        let document = decode_backup_document(&content)?;
        let (mut snapshot, settings) = document.into_state()?;
        snapshot.ensure_consistency();
        validate_store_snapshot(&snapshot)?;
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        let mut app_settings = self.settings.lock().map_err(|error| error.to_string())?;
        let previous_store = store.clone();
        let previous_settings = app_settings.clone();

        self.persist_locked_state(&snapshot, &settings)?;
        *store = snapshot.clone();
        *app_settings = settings.clone();

        if let Err(error) = self
            .logger
            .prune_expired_logs(settings.logging.retention_days)
            .map_err(|error| error.to_string())
        {
            let rollback_result = self.persist_locked_state(&previous_store, &previous_settings);
            *store = previous_store;
            *app_settings = previous_settings;
            drop(store);
            drop(app_settings);
            return match rollback_result {
                Ok(()) => Err(error),
                Err(rollback_error) => Err(combine_rollback_error(
                    error,
                    "state rollback failed",
                    rollback_error,
                )),
            };
        }
        drop(store);
        drop(app_settings);

        let logging_settings = self.logger_snapshot(&settings.logging)?;
        let editor_settings = EditorSettingsSnapshot::from(&settings.editor);
        let proofreading_settings = ProofreadingSettingsSnapshot::from(&settings.proofreading);

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
            editor_settings,
            logging_settings,
            proofreading_settings,
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

    /// Saves proofreading settings.
    ///
    /// # Errors
    ///
    /// Returns an error if the settings lock cannot be acquired or persistence fails.
    pub fn save_proofreading_settings(
        &self,
        input: ProofreadingSettingsInput,
    ) -> AppResult<ProofreadingSettingsSnapshot> {
        let started_at = Instant::now();
        validate_proofreading_settings_input(&input)?;
        let next_settings = input.into_settings();

        {
            let mut settings = self.settings.lock().map_err(|error| error.to_string())?;
            let previous = settings.clone();

            settings.proofreading = next_settings.clone();
            self.persist_locked_settings_with_rollback(&mut settings, previous)?;
        }

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "settings.proofreading_saved",
            module: "settings",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: proofreading_settings_context(&next_settings),
        });

        Ok(ProofreadingSettingsSnapshot::from(&next_settings))
    }

    /// Saves editor settings.
    ///
    /// # Errors
    ///
    /// Returns an error if the settings lock cannot be acquired or persistence fails.
    pub fn save_editor_settings(
        &self,
        input: EditorSettingsInput,
    ) -> AppResult<EditorSettingsSnapshot> {
        let started_at = Instant::now();
        let next_settings = input.into_settings();

        {
            let mut settings = self.settings.lock().map_err(|error| error.to_string())?;
            let previous = settings.clone();

            settings.editor = next_settings.clone();
            self.persist_locked_settings_with_rollback(&mut settings, previous)?;
        }

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "settings.editor_saved",
            module: "settings",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: editor_settings_context(&next_settings),
        });

        Ok(EditorSettingsSnapshot::from(&next_settings))
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

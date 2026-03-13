use std::{fs, path::PathBuf, sync::Mutex, time::Instant};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};

use crate::app::{
    backup::{BackupDocument, ImportedBackupSnapshot},
    logging::{AppLogger, LogEntry, LogEntrySnapshot, LogLevel},
    settings::{AppSettings, LoggingSettings, LoggingSettingsInput, LoggingSettingsSnapshot},
};
use crate::modules::{
    drafts::DraftInput,
    signatures::SignatureInput,
    store::StoreSnapshot,
    templates::TemplateInput,
    variable_presets::VariablePresetInput,
};

type AppResult<T> = Result<T, String>;

pub struct AppState {
    store_path: PathBuf,
    settings_path: PathBuf,
    store: Mutex<StoreSnapshot>,
    settings: Mutex<AppSettings>,
    logger: AppLogger,
}

impl AppState {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        let store_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&store_dir).map_err(|error| error.to_string())?;

        let settings_path = store_dir.join("maildraft-settings.json");
        let settings = load_settings(&settings_path)?;
        let logger = AppLogger::new(store_dir.join("logs"));

        let store_path = store_dir.join("maildraft-store.json");
        let mut store = if store_path.exists() {
            let content = fs::read_to_string(&store_path).map_err(|error| error.to_string())?;
            serde_json::from_str::<StoreSnapshot>(&content).map_err(|error| error.to_string())?
        } else {
            StoreSnapshot::seeded()
        };

        store.ensure_consistency();
        let state = Self {
            store_path,
            settings_path,
            store: Mutex::new(store),
            settings: Mutex::new(settings),
            logger,
        };
        state.persist_current_store()?;
        state.persist_current_settings()?;

        Ok(state)
    }

    pub fn load_snapshot(&self) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let store = self.store.lock().map_err(|error| error.to_string())?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "store.snapshot_loaded",
            module: "store",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: snapshot_counts_context(&snapshot),
        });

        Ok(snapshot)
    }

    pub fn save_draft(&self, input: DraftInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = draft_context(&input);

        match self.mutate_store(|store| {
            store.upsert_draft(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.save",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_counts_context(&snapshot)),
                });
                Ok(snapshot)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "draft.save",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    pub fn delete_draft(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.delete_draft(id, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.trash",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Ok(snapshot)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "draft.trash",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }

    pub fn restore_draft_history(
        &self,
        draft_id: &str,
        history_id: &str,
    ) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        if !store.restore_draft_history(draft_id, history_id, &timestamp()) {
            self.log_event(LogEntry {
                level: LogLevel::Error,
                event_name: "draft.restore_history",
                module: "drafts",
                result: "failure",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: Some("DRAFT_HISTORY_NOT_FOUND"),
                safe_context: Map::new(),
            });
            return Err("指定した履歴が見つかりませんでした。".to_string());
        }

        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "draft.restore_history",
            module: "drafts",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: snapshot_counts_context(&snapshot),
        });

        Ok(snapshot)
    }

    pub fn save_template(&self, input: TemplateInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = template_context(&input);

        match self.mutate_store(|store| {
            store.upsert_template(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.save",
                    module: "templates",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_counts_context(&snapshot)),
                });
                Ok(snapshot)
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

    pub fn save_variable_preset(&self, input: VariablePresetInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = variable_preset_context(&input);

        match self.mutate_store(|store| {
            store.upsert_variable_preset(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "variable_preset.save",
                    module: "variable_presets",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_counts_context(&snapshot)),
                });
                Ok(snapshot)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "variable_preset.save",
                    module: "variable_presets",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context,
                });
                Err(error)
            }
        }
    }

    pub fn delete_variable_preset(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let mut store = self.store.lock().map_err(|error| error.to_string())?;

        if !store.delete_variable_preset(id) {
            self.log_event(LogEntry {
                level: LogLevel::Error,
                event_name: "variable_preset.delete",
                module: "variable_presets",
                result: "failure",
                duration_ms: Some(elapsed_millis(started_at)),
                error_code: Some("VARIABLE_PRESET_NOT_FOUND"),
                safe_context: Map::new(),
            });
            return Err("指定した変数値セットが見つかりませんでした。".to_string());
        }

        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        let snapshot = store.clone();
        drop(store);

        self.log_event(LogEntry {
            level: LogLevel::Info,
            event_name: "variable_preset.delete",
            module: "variable_presets",
            result: "success",
            duration_ms: Some(elapsed_millis(started_at)),
            error_code: None,
            safe_context: snapshot_counts_context(&snapshot),
        });

        Ok(snapshot)
    }

    pub fn delete_template(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.delete_template(id, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.trash",
                    module: "templates",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Ok(snapshot)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "template.trash",
                    module: "templates",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }

    pub fn save_signature(&self, input: SignatureInput) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();
        let safe_context = signature_context(&input);

        match self.mutate_store(|store| {
            store.upsert_signature(input, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "signature.save",
                    module: "signatures",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: merge_context(safe_context, snapshot_counts_context(&snapshot)),
                });
                Ok(snapshot)
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

    pub fn delete_signature(&self, id: &str) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.delete_signature(id, &timestamp());
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "signature.trash",
                    module: "signatures",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Ok(snapshot)
            }
            Err(error) => {
                self.log_event(LogEntry {
                    level: LogLevel::Error,
                    event_name: "signature.trash",
                    module: "signatures",
                    result: "failure",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: Some("STORE_WRITE_FAILED"),
                    safe_context: Map::new(),
                });
                Err(error)
            }
        }
    }

    pub fn restore_draft_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.restore_item_from_trash("draft", |store| store.restore_draft_from_trash(id))
    }

    pub fn restore_template_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.restore_item_from_trash("template", |store| store.restore_template_from_trash(id))
    }

    pub fn restore_signature_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.restore_item_from_trash("signature", |store| store.restore_signature_from_trash(id))
    }

    pub fn permanently_delete_draft_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.permanently_delete_item_from_trash("draft", |store| {
            store.permanently_delete_draft_from_trash(id)
        })
    }

    pub fn permanently_delete_template_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.permanently_delete_item_from_trash("template", |store| {
            store.permanently_delete_template_from_trash(id)
        })
    }

    pub fn permanently_delete_signature_from_trash(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.permanently_delete_item_from_trash("signature", |store| {
            store.permanently_delete_signature_from_trash(id)
        })
    }

    pub fn empty_trash(&self) -> AppResult<StoreSnapshot> {
        let started_at = Instant::now();

        match self.mutate_store(|store| {
            store.empty_trash();
        }) {
            Ok(snapshot) => {
                self.log_event(LogEntry {
                    level: LogLevel::Info,
                    event_name: "trash.empty",
                    module: "trash",
                    result: "success",
                    duration_ms: Some(elapsed_millis(started_at)),
                    error_code: None,
                    safe_context: snapshot_counts_context(&snapshot),
                });
                Ok(snapshot)
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

    fn mutate_store<F>(&self, mutator: F) -> AppResult<StoreSnapshot>
    where
        F: FnOnce(&mut StoreSnapshot),
    {
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        mutator(&mut store);
        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        Ok(store.clone())
    }

    fn persist_current_store(&self) -> AppResult<()> {
        let store = self.store.lock().map_err(|error| error.to_string())?;
        self.persist_locked_store(&store)
    }

    fn persist_current_settings(&self) -> AppResult<()> {
        let settings = self.settings.lock().map_err(|error| error.to_string())?;
        self.persist_locked_settings(&settings)
    }

    fn persist_locked_store(&self, store: &StoreSnapshot) -> AppResult<()> {
        let content = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
        fs::write(&self.store_path, content).map_err(|error| error.to_string())
    }

    fn persist_locked_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let content = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
        fs::write(&self.settings_path, content).map_err(|error| error.to_string())
    }

    fn logging_settings_snapshot(&self) -> AppResult<LoggingSettingsSnapshot> {
        let logging_settings = {
            let settings = self.settings.lock().map_err(|error| error.to_string())?;
            settings.logging.clone()
        };

        self.logger
            .prune_expired_logs(logging_settings.retention_days)
            .map_err(|error| error.to_string())?;

        self.logger_snapshot(&logging_settings)
    }

    fn logger_snapshot(
        &self,
        logging_settings: &LoggingSettings,
    ) -> AppResult<LoggingSettingsSnapshot> {
        self.logger
            .snapshot(logging_settings)
            .map_err(|error| error.to_string())
    }

    fn current_logging_settings(&self) -> Option<LoggingSettings> {
        let settings = self.settings.lock().ok()?;
        Some(settings.logging.clone())
    }

    fn log_event(&self, entry: LogEntry) {
        if let Some(logging_settings) = self.current_logging_settings() {
            self.log_event_with_settings(&logging_settings, entry);
        }
    }

    fn log_event_with_settings(&self, logging_settings: &LoggingSettings, entry: LogEntry) {
        let _ = self.logger.record(logging_settings, entry);
    }

    fn restore_item_from_trash<F>(&self, kind: &str, mutator: F) -> AppResult<StoreSnapshot>
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

    fn permanently_delete_item_from_trash<F>(
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

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    format!("{}", duration.as_secs())
}

fn load_settings(path: &PathBuf) -> AppResult<AppSettings> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str::<AppSettings>(&content)
        .map(AppSettings::normalized)
        .map_err(|error| error.to_string())
}

fn elapsed_millis(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis() as u64
}

fn snapshot_counts_context(snapshot: &StoreSnapshot) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("draft_count".to_string(), json!(snapshot.drafts.len()));
    context.insert(
        "variable_preset_count".to_string(),
        json!(snapshot.variable_presets.len()),
    );
    context.insert(
        "template_count".to_string(),
        json!(snapshot.templates.len()),
    );
    context.insert(
        "signature_count".to_string(),
        json!(snapshot.signatures.len()),
    );
    context.insert(
        "trash_count".to_string(),
        json!(snapshot.trash.item_count()),
    );
    context
}

fn trash_kind_context(kind: &str) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("kind".to_string(), json!(kind));
    context
}

fn draft_context(input: &DraftInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "has_template".to_string(),
        json!(input.template_id.is_some()),
    );
    context.insert(
        "has_signature".to_string(),
        json!(input.signature_id.is_some()),
    );
    context.insert(
        "title_length".to_string(),
        json!(input.title.chars().count()),
    );
    context.insert("is_pinned".to_string(), json!(input.is_pinned));
    context.insert(
        "subject_length".to_string(),
        json!(input.subject.chars().count()),
    );
    context.insert(
        "recipient_length".to_string(),
        json!(input.recipient.chars().count()),
    );
    context.insert(
        "opening_length".to_string(),
        json!(input.opening.chars().count()),
    );
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert(
        "closing_length".to_string(),
        json!(input.closing.chars().count()),
    );
    context.insert(
        "variable_count".to_string(),
        json!(input.variable_values.len()),
    );
    context
}

fn template_context(input: &TemplateInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "has_signature".to_string(),
        json!(input.signature_id.is_some()),
    );
    context.insert("is_pinned".to_string(), json!(input.is_pinned));
    context.insert("name_length".to_string(), json!(input.name.chars().count()));
    context.insert(
        "subject_length".to_string(),
        json!(input.subject.chars().count()),
    );
    context.insert(
        "recipient_length".to_string(),
        json!(input.recipient.chars().count()),
    );
    context.insert(
        "opening_length".to_string(),
        json!(input.opening.chars().count()),
    );
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert(
        "closing_length".to_string(),
        json!(input.closing.chars().count()),
    );
    context
}

fn variable_preset_context(input: &VariablePresetInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("name_length".to_string(), json!(input.name.chars().count()));
    context.insert("value_count".to_string(), json!(input.values.len()));
    context
}

fn signature_context(input: &SignatureInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("name_length".to_string(), json!(input.name.chars().count()));
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert("is_pinned".to_string(), json!(input.is_pinned));
    context.insert("is_default".to_string(), json!(input.is_default));
    context
}

fn logging_settings_context(settings: &LoggingSettings) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("retention_days".to_string(), json!(settings.retention_days));
    context.insert("mode".to_string(), json!(settings.mode.as_str()));
    context
}

fn merge_context(mut left: Map<String, Value>, right: Map<String, Value>) -> Map<String, Value> {
    left.extend(right);
    left
}

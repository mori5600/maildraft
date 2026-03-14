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

#[cfg(test)]
mod tests {
    use std::{collections::BTreeMap, fs, path::Path, sync::Mutex};

    use pretty_assertions::assert_eq;
    use serde_json::json;
    use tempfile::tempdir;

    use super::{
        draft_context, load_settings, logging_settings_context, merge_context,
        snapshot_counts_context, template_context, trash_kind_context, variable_preset_context,
        AppState,
    };
    use crate::{
        app::{
            logging::{AppLogger, LogEntry, LogLevel},
            settings::{
                AppSettings, LoggingMode, LoggingSettings, LoggingSettingsInput,
            },
        },
        modules::{
            drafts::DraftInput, signatures::SignatureInput, store::StoreSnapshot,
            templates::TemplateInput, variable_presets::VariablePresetInput,
        },
    };

    fn make_state() -> (AppState, tempfile::TempDir) {
        let directory = tempdir().expect("tempdir");
        let state = AppState {
            store_path: directory.path().join("maildraft-store.json"),
            settings_path: directory.path().join("maildraft-settings.json"),
            store: Mutex::new(StoreSnapshot::seeded()),
            settings: Mutex::new(AppSettings::default()),
            logger: AppLogger::new(directory.path().join("logs")),
        };

        state.persist_current_store().expect("persist store");
        state.persist_current_settings().expect("persist settings");

        (state, directory)
    }

    fn read_store(path: &Path) -> StoreSnapshot {
        serde_json::from_str(&fs::read_to_string(path).expect("read store")).expect("store json")
    }

    fn read_settings_file(path: &Path) -> AppSettings {
        serde_json::from_str(&fs::read_to_string(path).expect("read settings"))
            .expect("settings json")
    }

    #[test]
    fn load_settings_defaults_missing_files_and_normalizes_saved_values() {
        let directory = tempdir().expect("tempdir");
        let missing_path = directory.path().join("missing.json");

        let default_settings = load_settings(&missing_path).expect("default settings");
        assert_eq!(default_settings.logging.mode, LoggingMode::ErrorsOnly);
        assert_eq!(default_settings.logging.retention_days, 14);

        let saved_path = directory.path().join("settings.json");
        let content = serde_json::to_string(&AppSettings {
            logging: LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 99,
            },
        })
        .expect("serialize settings");
        fs::write(&saved_path, content).expect("write settings");

        let loaded = load_settings(&saved_path).expect("load settings");
        assert_eq!(loaded.logging.mode, LoggingMode::Standard);
        assert_eq!(loaded.logging.retention_days, 14);
    }

    #[test]
    fn snapshot_counts_context_reports_current_collection_sizes() {
        let snapshot = StoreSnapshot::seeded();
        let context = snapshot_counts_context(&snapshot);

        assert_eq!(context.get("draft_count"), Some(&json!(1)));
        assert_eq!(context.get("variable_preset_count"), Some(&json!(0)));
        assert_eq!(context.get("template_count"), Some(&json!(1)));
        assert_eq!(context.get("signature_count"), Some(&json!(1)));
        assert_eq!(context.get("trash_count"), Some(&json!(0)));
    }

    #[test]
    fn input_context_builders_capture_safe_lengths_and_flags() {
        let draft = DraftInput {
            id: "draft-1".to_string(),
            title: "Hello".to_string(),
            is_pinned: true,
            subject: "Sub".to_string(),
            recipient: "To".to_string(),
            opening: "Open".to_string(),
            body: "Body".to_string(),
            closing: "Bye".to_string(),
            template_id: Some("template-1".to_string()),
            signature_id: None,
            variable_values: BTreeMap::from([
                ("company".to_string(), "ACME".to_string()),
                ("person".to_string(), "Yamada".to_string()),
            ]),
        };
        let template = TemplateInput {
            id: "template-1".to_string(),
            name: "Thanks".to_string(),
            is_pinned: false,
            subject: "Follow up".to_string(),
            recipient: "Customer".to_string(),
            opening: "Hello".to_string(),
            body: "Body".to_string(),
            closing: "Regards".to_string(),
            signature_id: Some("signature-1".to_string()),
        };
        let preset = VariablePresetInput {
            id: "preset-1".to_string(),
            name: "A".to_string(),
            values: BTreeMap::from([("company".to_string(), "ACME".to_string())]),
        };
        let signature = SignatureInput {
            id: "signature-1".to_string(),
            name: "Std".to_string(),
            is_pinned: true,
            body: "Team".to_string(),
            is_default: false,
        };
        let logging = LoggingSettings {
            mode: LoggingMode::Off,
            retention_days: 30,
        };

        let draft_values = draft_context(&draft);
        assert_eq!(draft_values.get("has_template"), Some(&json!(true)));
        assert_eq!(draft_values.get("has_signature"), Some(&json!(false)));
        assert_eq!(draft_values.get("title_length"), Some(&json!(5)));
        assert_eq!(draft_values.get("is_pinned"), Some(&json!(true)));
        assert_eq!(draft_values.get("variable_count"), Some(&json!(2)));

        let template_values = template_context(&template);
        assert_eq!(template_values.get("has_signature"), Some(&json!(true)));
        assert_eq!(template_values.get("name_length"), Some(&json!(6)));
        assert_eq!(template_values.get("subject_length"), Some(&json!(9)));

        let preset_values = variable_preset_context(&preset);
        assert_eq!(preset_values.get("name_length"), Some(&json!(1)));
        assert_eq!(preset_values.get("value_count"), Some(&json!(1)));

        let signature_values = super::signature_context(&signature);
        assert_eq!(signature_values.get("name_length"), Some(&json!(3)));
        assert_eq!(signature_values.get("body_length"), Some(&json!(4)));
        assert_eq!(signature_values.get("is_pinned"), Some(&json!(true)));
        assert_eq!(signature_values.get("is_default"), Some(&json!(false)));

        let logging_values = logging_settings_context(&logging);
        assert_eq!(logging_values.get("mode"), Some(&json!("off")));
        assert_eq!(logging_values.get("retention_days"), Some(&json!(30)));
    }

    #[test]
    fn trash_kind_and_merge_context_preserve_expected_keys() {
        let merged = merge_context(
            serde_json::Map::from_iter([
                ("left_only".to_string(), json!(1)),
                ("shared".to_string(), json!("left")),
            ]),
            serde_json::Map::from_iter([
                ("shared".to_string(), json!("right")),
                ("kind".to_string(), json!("template")),
            ]),
        );

        assert_eq!(trash_kind_context("template").get("kind"), Some(&json!("template")));
        assert_eq!(merged.get("left_only"), Some(&json!(1)));
        assert_eq!(merged.get("shared"), Some(&json!("right")));
        assert_eq!(merged.get("kind"), Some(&json!("template")));
    }

    #[test]
    fn save_template_and_variable_preset_persist_store_updates() {
        let (state, _directory) = make_state();

        let snapshot = state
            .save_template(TemplateInput {
                id: "template-follow-up".to_string(),
                name: "確認メール".to_string(),
                is_pinned: true,
                subject: "ご確認のお願い".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "ご確認をお願いします。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                signature_id: Some("signature-default".to_string()),
            })
            .expect("save template");
        assert_eq!(snapshot.templates.len(), 2);
        assert_eq!(snapshot.templates[0].id, "template-follow-up");

        let snapshot = state
            .save_variable_preset(VariablePresetInput {
                id: "preset-a".to_string(),
                name: "A社向け".to_string(),
                values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
            })
            .expect("save preset");
        assert_eq!(snapshot.variable_presets.len(), 1);

        let snapshot = state
            .delete_variable_preset("preset-a")
            .expect("delete preset");
        assert_eq!(snapshot.variable_presets.len(), 0);
        assert_eq!(
            state.delete_variable_preset("missing").unwrap_err(),
            "指定した変数値セットが見つかりませんでした。"
        );

        let persisted = read_store(&state.store_path);
        assert!(persisted
            .templates
            .iter()
            .any(|template| template.id == "template-follow-up"));
        assert!(persisted.variable_presets.is_empty());
    }

    #[test]
    fn trash_operations_round_trip_and_persist_snapshot_changes() {
        let (state, _directory) = make_state();

        let deleted = state.delete_template("template-thanks").expect("trash template");
        assert!(deleted.templates.is_empty());
        assert_eq!(deleted.trash.templates.len(), 1);

        let restored = state
            .restore_template_from_trash("template-thanks")
            .expect("restore template");
        assert_eq!(restored.templates.len(), 1);
        assert!(restored.trash.templates.is_empty());

        let deleted = state
            .delete_signature("signature-default")
            .expect("trash signature");
        assert!(deleted.signatures.is_empty());
        assert_eq!(deleted.trash.signatures.len(), 1);

        let deleted = state
            .permanently_delete_signature_from_trash("signature-default")
            .expect("delete signature permanently");
        assert!(deleted.trash.signatures.is_empty());
        assert_eq!(
            state.restore_signature_from_trash("missing").unwrap_err(),
            "指定した項目がゴミ箱に見つかりませんでした。"
        );

        state.delete_draft("draft-welcome").expect("trash draft");
        let emptied = state.empty_trash().expect("empty trash");
        assert!(emptied.trash.drafts.is_empty());
        assert!(emptied.trash.templates.is_empty());
        assert!(emptied.trash.signatures.is_empty());

        let persisted = read_store(&state.store_path);
        assert!(persisted.trash.drafts.is_empty());
        assert!(persisted.trash.templates.is_empty());
        assert!(persisted.trash.signatures.is_empty());
    }

    #[test]
    fn logging_settings_and_backup_methods_round_trip_state() {
        let (state, directory) = make_state();

        state
            .save_template(TemplateInput {
                id: "template-exported".to_string(),
                name: "書き出し用".to_string(),
                is_pinned: false,
                subject: "件名".to_string(),
                recipient: "".to_string(),
                opening: "冒頭".to_string(),
                body: "本文".to_string(),
                closing: "末尾".to_string(),
                signature_id: Some("signature-default".to_string()),
            })
            .expect("save template");

        let settings_snapshot = state
            .save_logging_settings(LoggingSettingsInput {
                mode: LoggingMode::Standard,
                retention_days: 30,
            })
            .expect("save logging settings");
        assert_eq!(settings_snapshot.mode, LoggingMode::Standard);
        assert_eq!(settings_snapshot.retention_days, 30);

        let persisted_settings = read_settings_file(&state.settings_path);
        assert_eq!(persisted_settings.logging.mode, LoggingMode::Standard);
        assert_eq!(persisted_settings.logging.retention_days, 30);

        state.log_event_with_settings(
            &LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 30,
            },
            LogEntry {
                level: LogLevel::Info,
                event_name: "tests.logging",
                module: "tests",
                result: "success",
                duration_ms: Some(5),
                error_code: None,
                safe_context: serde_json::Map::new(),
            },
        );

        let recent_logs = state.load_recent_logs(Some(5)).expect("recent logs");
        assert!(!recent_logs.is_empty());

        let cleared = state.clear_logs().expect("clear logs");
        assert_eq!(cleared.file_count, 0);

        let backup_path = directory.path().join("maildraft-backup.json");
        let exported_path = state
            .export_backup(backup_path.to_str().expect("backup path"))
            .expect("export backup");
        assert_eq!(exported_path, backup_path.display().to_string());

        let (import_state, _other_directory) = make_state();
        let imported = import_state
            .import_backup(backup_path.to_str().expect("backup path"))
            .expect("import backup");
        assert_eq!(imported.snapshot.templates.len(), 2);
        assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
        assert_eq!(imported.logging_settings.retention_days, 30);
    }
}

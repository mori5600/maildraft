mod context;
mod draft_commands;
mod internal;
mod settings_backup;
mod signature_commands;
mod template_commands;
mod trash_commands;
mod variable_preset_commands;

#[cfg(test)]
mod tests;

use std::{fs, path::PathBuf, sync::Mutex, time::Instant};

#[cfg(test)]
use std::path::Path;

use tauri::{AppHandle, Manager};

use crate::app::{
    logging::{AppLogger, LogEntry, LogLevel},
    settings::AppSettings,
};
use crate::modules::store::StoreSnapshot;

use self::context::{elapsed_millis, snapshot_counts_context};
use self::internal::load_settings;

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

    #[cfg(test)]
    pub(crate) fn new_for_tests(root: &Path) -> AppResult<Self> {
        let state = Self {
            store_path: root.join("maildraft-store.json"),
            settings_path: root.join("maildraft-settings.json"),
            store: Mutex::new(StoreSnapshot::seeded()),
            settings: Mutex::new(AppSettings::default()),
            logger: AppLogger::new(root.join("logs")),
        };
        state.persist_current_store()?;
        state.persist_current_settings()?;
        Ok(state)
    }
}

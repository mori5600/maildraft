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
    storage::{
        load_app_settings_with_status, load_store_snapshot_with_status, StartupNoticeSnapshot,
        StartupNoticeTone,
    },
};
use crate::modules::store::StoreSnapshot;

use self::context::{elapsed_millis, snapshot_counts_context};

type AppResult<T> = Result<T, String>;

pub struct AppState {
    store_path: PathBuf,
    settings_path: PathBuf,
    store: Mutex<StoreSnapshot>,
    settings: Mutex<AppSettings>,
    startup_notice: Mutex<Option<StartupNoticeSnapshot>>,
    logger: AppLogger,
}

impl AppState {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        let store_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&store_dir).map_err(|error| error.to_string())?;

        Self::from_paths(
            store_dir.join("maildraft-store.json"),
            store_dir.join("maildraft-settings.json"),
            store_dir.join("logs"),
        )
    }

    fn from_paths(
        store_path: PathBuf,
        settings_path: PathBuf,
        logs_path: PathBuf,
    ) -> AppResult<Self> {
        if let Some(store_dir) = store_path.parent() {
            fs::create_dir_all(store_dir).map_err(|error| error.to_string())?;
        }

        if let Some(settings_dir) = settings_path.parent() {
            fs::create_dir_all(settings_dir).map_err(|error| error.to_string())?;
        }

        fs::create_dir_all(&logs_path).map_err(|error| error.to_string())?;

        let settings_outcome = load_app_settings_with_status(&settings_path)?;
        let logger = AppLogger::new(logs_path);

        let store_outcome = load_store_snapshot_with_status(&store_path)?;
        let mut store = store_outcome.value;

        store.ensure_consistency();
        let state = Self {
            store_path,
            settings_path,
            store: Mutex::new(store),
            settings: Mutex::new(settings_outcome.value),
            startup_notice: Mutex::new(combine_startup_notice(
                [
                    settings_outcome.startup_notice,
                    store_outcome.startup_notice,
                ]
                .into_iter()
                .flatten(),
            )),
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

    pub fn load_startup_notice(&self) -> AppResult<Option<StartupNoticeSnapshot>> {
        let startup_notice = self
            .startup_notice
            .lock()
            .map_err(|error| error.to_string())?;
        Ok(startup_notice.clone())
    }

    #[cfg(test)]
    pub(crate) fn new_for_tests(root: &Path) -> AppResult<Self> {
        fs::create_dir_all(root).map_err(|error| error.to_string())?;
        Self::from_paths(
            root.join("maildraft-store.json"),
            root.join("maildraft-settings.json"),
            root.join("logs"),
        )
    }
}

fn combine_startup_notice(
    notices: impl IntoIterator<Item = StartupNoticeSnapshot>,
) -> Option<StartupNoticeSnapshot> {
    let notices: Vec<_> = notices.into_iter().collect();
    if notices.is_empty() {
        return None;
    }

    let tone = if notices
        .iter()
        .any(|notice| notice.tone == StartupNoticeTone::Warning)
    {
        StartupNoticeTone::Warning
    } else {
        StartupNoticeTone::Notice
    };

    Some(StartupNoticeSnapshot {
        message: notices
            .into_iter()
            .map(|notice| notice.message)
            .collect::<Vec<_>>()
            .join(" "),
        tone,
    })
}

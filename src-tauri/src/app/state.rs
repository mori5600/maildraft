mod block_commands;
mod context;
mod draft_commands;
mod internal;
mod memo_commands;
mod settings_backup;
mod signature_commands;
mod template_commands;
mod trash_commands;
mod variable_preset_commands;

#[cfg(test)]
mod tests;

use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Instant,
};

#[cfg(test)]
use std::path::Path;

use tauri::{AppHandle, Manager};

use crate::app::{
    logging::{AppLogger, LogEntry, LogLevel},
    persistence::{
        bootstrap_runtime_repository, PersistenceRepository, PreparedRepositoryBootstrap,
    },
    settings::AppSettings,
    storage::{StartupNoticeSnapshot, StartupNoticeTone},
};
use crate::modules::store::StoreSnapshot;

#[cfg(test)]
use crate::app::persistence::{bootstrap_json_repository, JsonRepository};

use self::context::{elapsed_millis, snapshot_counts_context};

type AppResult<T> = Result<T, String>;

pub struct AppState {
    repository: Arc<dyn PersistenceRepository>,
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

        Self::from_runtime_paths(
            store_dir.join("maildraft-store.json"),
            store_dir.join("maildraft-settings.json"),
            store_dir.join("maildraft.sqlite3"),
            store_dir.join("logs"),
        )
    }

    fn from_runtime_paths(
        store_path: PathBuf,
        settings_path: PathBuf,
        database_path: PathBuf,
        logs_path: PathBuf,
    ) -> AppResult<Self> {
        let bootstrap = bootstrap_runtime_repository(store_path, settings_path, database_path)?;
        Self::from_bootstrap(bootstrap, logs_path)
    }

    #[cfg(test)]
    fn from_json_paths(
        store_path: PathBuf,
        settings_path: PathBuf,
        logs_path: PathBuf,
    ) -> AppResult<Self> {
        let bootstrap = bootstrap_json_repository(store_path, settings_path)?;
        Self::from_bootstrap(bootstrap, logs_path)
    }

    fn from_bootstrap(
        bootstrap: PreparedRepositoryBootstrap,
        logs_path: PathBuf,
    ) -> AppResult<Self> {
        let PreparedRepositoryBootstrap {
            repository,
            settings_outcome,
            store_outcome,
            extra_startup_notices,
        } = bootstrap;
        let protected_paths = repository.protected_backup_paths();
        for path in protected_paths {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
        }

        fs::create_dir_all(&logs_path).map_err(|error| error.to_string())?;
        let logger = AppLogger::new(logs_path);
        let mut store = store_outcome.value;

        store.ensure_consistency();
        let state = Self {
            repository,
            store: Mutex::new(store),
            settings: Mutex::new(settings_outcome.value),
            startup_notice: Mutex::new(combine_startup_notice(
                [
                    Some(extra_startup_notices),
                    Some(
                        [
                            settings_outcome.startup_notice,
                            store_outcome.startup_notice,
                        ]
                        .into_iter()
                        .flatten()
                        .collect(),
                    ),
                ]
                .into_iter()
                .flatten()
                .flatten(),
            )),
            logger,
        };
        state.persist_current_state()?;

        Ok(state)
    }

    #[cfg(test)]
    pub(crate) fn new_for_tests(root: &Path) -> AppResult<Self> {
        fs::create_dir_all(root).map_err(|error| error.to_string())?;
        Self::from_json_paths(
            root.join("maildraft-store.json"),
            root.join("maildraft-settings.json"),
            root.join("logs"),
        )
    }

    #[cfg(test)]
    pub(crate) fn new_for_runtime_tests(root: &Path) -> AppResult<Self> {
        fs::create_dir_all(root).map_err(|error| error.to_string())?;
        Self::from_runtime_paths(
            root.join("maildraft-store.json"),
            root.join("maildraft-settings.json"),
            root.join("maildraft.sqlite3"),
            root.join("logs"),
        )
    }

    #[cfg(test)]
    pub(crate) fn store_document_path_for_tests(&self) -> PathBuf {
        self.repository
            .store_document_path()
            .expect("JSON store path should be available in tests")
    }

    #[cfg(test)]
    pub(crate) fn settings_document_path_for_tests(&self) -> PathBuf {
        self.repository
            .settings_document_path()
            .expect("JSON settings path should be available in tests")
    }

    #[cfg(test)]
    pub(crate) fn replace_json_repository_for_tests(
        &mut self,
        store_path: PathBuf,
        settings_path: PathBuf,
    ) {
        self.repository = Arc::new(JsonRepository::new(store_path, settings_path));
    }

    pub(crate) fn protected_backup_paths(&self) -> Vec<PathBuf> {
        self.repository.protected_backup_paths()
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

#[cfg(test)]
mod state_unit_tests {
    use pretty_assertions::assert_eq;

    use super::combine_startup_notice;
    use crate::app::storage::{StartupNoticeSnapshot, StartupNoticeTone};

    #[test]
    fn combine_startup_notice_returns_none_when_no_messages_exist() {
        assert_eq!(combine_startup_notice(Vec::new()), None);
    }

    #[test]
    fn combine_startup_notice_keeps_notice_tone_when_all_messages_are_notices() {
        let combined = combine_startup_notice([
            StartupNoticeSnapshot {
                message: "設定を読み込みました。".to_string(),
                tone: StartupNoticeTone::Notice,
            },
            StartupNoticeSnapshot {
                message: "テンプレートを更新しました。".to_string(),
                tone: StartupNoticeTone::Notice,
            },
        ])
        .expect("combined notice");

        assert_eq!(combined.tone, StartupNoticeTone::Notice);
        assert_eq!(
            combined.message,
            "設定を読み込みました。 テンプレートを更新しました。"
        );
    }

    #[test]
    fn combine_startup_notice_prefers_warning_when_any_warning_is_present() {
        let combined = combine_startup_notice([
            StartupNoticeSnapshot {
                message: "設定を読み込みました。".to_string(),
                tone: StartupNoticeTone::Notice,
            },
            StartupNoticeSnapshot {
                message: "バックアップから復旧しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            },
        ])
        .expect("combined warning");

        assert_eq!(combined.tone, StartupNoticeTone::Warning);
        assert_eq!(
            combined.message,
            "設定を読み込みました。 バックアップから復旧しました。"
        );
    }
}

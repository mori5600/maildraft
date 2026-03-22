#[allow(dead_code)]
pub(crate) mod sqlite;

use std::path::PathBuf;
use std::{path::Path, sync::Arc};

use crate::{
    app::{
        settings::AppSettings,
        storage::{
            load_app_settings_with_status, load_store_snapshot_with_status, write_app_settings,
            write_store_snapshot, LoadOutcome, StartupNoticeSnapshot, StartupNoticeTone,
        },
    },
    modules::store::StoreSnapshot,
};

#[derive(Debug, Clone)]
pub(crate) struct PersistedAppState {
    pub snapshot: StoreSnapshot,
    pub settings: AppSettings,
}

pub(crate) trait PersistenceRepository: Send + Sync {
    fn load_app_settings(&self) -> Result<LoadOutcome<AppSettings>, String>;
    fn load_store_snapshot(&self) -> Result<LoadOutcome<StoreSnapshot>, String>;
    fn save_app_settings(&self, settings: &AppSettings) -> Result<(), String>;
    fn save_store_snapshot(&self, snapshot: &StoreSnapshot) -> Result<(), String>;
    fn save_state(&self, snapshot: &StoreSnapshot, settings: &AppSettings) -> Result<(), String>;

    fn protected_backup_paths(&self) -> Vec<PathBuf>;

    fn load_state(&self) -> Result<PersistedAppState, String> {
        Ok(PersistedAppState {
            snapshot: self.load_store_snapshot()?.value,
            settings: self.load_app_settings()?.value,
        })
    }

    #[cfg(test)]
    fn store_document_path(&self) -> Option<PathBuf> {
        None
    }

    #[cfg(test)]
    fn settings_document_path(&self) -> Option<PathBuf> {
        None
    }
}

#[derive(Debug, Clone)]
pub(crate) struct JsonRepository {
    store_path: PathBuf,
    settings_path: PathBuf,
}

impl JsonRepository {
    pub(crate) fn new(store_path: PathBuf, settings_path: PathBuf) -> Self {
        Self {
            store_path,
            settings_path,
        }
    }
}

pub(crate) struct PreparedRepositoryBootstrap {
    pub repository: Arc<dyn PersistenceRepository>,
    pub settings_outcome: LoadOutcome<AppSettings>,
    pub store_outcome: LoadOutcome<StoreSnapshot>,
    pub extra_startup_notices: Vec<StartupNoticeSnapshot>,
}

#[cfg(test)]
pub(crate) fn bootstrap_json_repository(
    store_path: PathBuf,
    settings_path: PathBuf,
) -> Result<PreparedRepositoryBootstrap, String> {
    load_bootstrap(Arc::new(JsonRepository::new(store_path, settings_path)))
}

pub(crate) fn bootstrap_runtime_repository(
    store_path: PathBuf,
    settings_path: PathBuf,
    database_path: PathBuf,
) -> Result<PreparedRepositoryBootstrap, String> {
    let legacy_repository = Arc::new(JsonRepository::new(
        store_path.clone(),
        settings_path.clone(),
    ));
    let sqlite_repository = sqlite::SqliteRepository::new(database_path);
    let legacy_exists = legacy_json_state_exists(&store_path, &settings_path);

    match sqlite_repository.has_saved_state() {
        Ok(true) => load_bootstrap(Arc::new(sqlite_repository)),
        Ok(false) if legacy_exists => {
            let legacy_bootstrap = load_bootstrap(legacy_repository.clone())?;
            match sqlite_repository
                .save_full_state(
                    &legacy_bootstrap.store_outcome.value,
                    &legacy_bootstrap.settings_outcome.value,
                )
            {
                Ok(()) => {
                    let mut sqlite_bootstrap = load_bootstrap(Arc::new(sqlite_repository))?;
                    sqlite_bootstrap.extra_startup_notices.extend(
                        [
                            legacy_bootstrap.settings_outcome.startup_notice,
                            legacy_bootstrap.store_outcome.startup_notice,
                        ]
                        .into_iter()
                        .flatten(),
                    );
                    sqlite_bootstrap.extra_startup_notices.push(StartupNoticeSnapshot {
                        message: "ローカルデータを SQLite へ移行しました。".to_string(),
                        tone: StartupNoticeTone::Notice,
                    });
                    Ok(sqlite_bootstrap)
                }
                Err(error) => {
                    eprintln!("MailDraft SQLite migration failed, falling back to legacy JSON storage: {error}");
                    let mut legacy_bootstrap = legacy_bootstrap;
                    legacy_bootstrap.extra_startup_notices.push(StartupNoticeSnapshot {
                        message: "SQLite への移行に失敗したため従来形式で起動しました。".to_string(),
                        tone: StartupNoticeTone::Warning,
                    });
                    Ok(legacy_bootstrap)
                }
            }
        }
        Ok(false) => load_bootstrap(Arc::new(sqlite_repository)).or_else(|error| {
            eprintln!(
                "MailDraft could not initialize SQLite storage and will use legacy JSON storage: {error}"
            );
            let mut bootstrap = load_bootstrap(legacy_repository)?;
            bootstrap.extra_startup_notices.push(StartupNoticeSnapshot {
                message: "SQLite を利用できなかったため従来形式で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            });
            Ok(bootstrap)
        }),
        Err(error) => {
            eprintln!(
                "MailDraft could not open SQLite storage and will use legacy JSON storage: {error}"
            );
            let mut bootstrap = load_bootstrap(legacy_repository)?;
            bootstrap.extra_startup_notices.push(StartupNoticeSnapshot {
                message: "SQLite を利用できなかったため従来形式で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            });
            Ok(bootstrap)
        }
    }
}

fn load_bootstrap(
    repository: Arc<dyn PersistenceRepository>,
) -> Result<PreparedRepositoryBootstrap, String> {
    let settings_outcome = repository.load_app_settings()?;
    let store_outcome = repository.load_store_snapshot()?;

    Ok(PreparedRepositoryBootstrap {
        repository,
        settings_outcome,
        store_outcome,
        extra_startup_notices: Vec::new(),
    })
}

fn legacy_json_state_exists(store_path: &Path, settings_path: &Path) -> bool {
    [
        store_path,
        settings_path,
        &legacy_backup_path(store_path),
        &legacy_backup_path(settings_path),
    ]
    .iter()
    .any(|path| path.exists())
}

fn legacy_backup_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("maildraft-data");
    path.with_file_name(format!("{file_name}.bak"))
}

impl PersistenceRepository for JsonRepository {
    fn load_app_settings(&self) -> Result<LoadOutcome<AppSettings>, String> {
        load_app_settings_with_status(&self.settings_path)
    }

    fn load_store_snapshot(&self) -> Result<LoadOutcome<StoreSnapshot>, String> {
        load_store_snapshot_with_status(&self.store_path)
    }

    fn save_app_settings(&self, settings: &AppSettings) -> Result<(), String> {
        write_app_settings(&self.settings_path, settings)
    }

    fn save_store_snapshot(&self, snapshot: &StoreSnapshot) -> Result<(), String> {
        write_store_snapshot(&self.store_path, snapshot)
    }

    fn save_state(&self, snapshot: &StoreSnapshot, settings: &AppSettings) -> Result<(), String> {
        let previous_store = load_store_snapshot_with_status(&self.store_path)?.value;

        write_store_snapshot(&self.store_path, snapshot)?;
        match write_app_settings(&self.settings_path, settings) {
            Ok(()) => Ok(()),
            Err(error) => match write_store_snapshot(&self.store_path, &previous_store) {
                Ok(()) => Err(error),
                Err(rollback_error) => {
                    Err(format!("{error} / store rollback failed: {rollback_error}"))
                }
            },
        }
    }

    fn protected_backup_paths(&self) -> Vec<PathBuf> {
        vec![self.store_path.clone(), self.settings_path.clone()]
    }

    #[cfg(test)]
    fn store_document_path(&self) -> Option<PathBuf> {
        Some(self.store_path.clone())
    }

    #[cfg(test)]
    fn settings_document_path(&self) -> Option<PathBuf> {
        Some(self.settings_path.clone())
    }
}

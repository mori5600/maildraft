//! Storage helpers for MailDraft's JSON documents.
//!
//! Corrupt primary files fall back to backups, then to defaults.

mod atomic_write;
mod settings_document;
mod store_document;

use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

use crate::{app::settings::AppSettings, modules::store::StoreSnapshot};

use self::{
    atomic_write::write_json_safely,
    settings_document::{decode_settings, encode_settings},
    store_document::{decode_store_snapshot, encode_store_snapshot},
};

type AppResult<T> = Result<T, String>;

pub const STORAGE_DOCUMENT_APP: &str = "maildraft";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StartupNoticeTone {
    Notice,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupNoticeSnapshot {
    pub message: String,
    pub tone: StartupNoticeTone,
}

/// Carries a loaded value plus any startup notice caused by recovery.
pub struct LoadOutcome<T> {
    pub startup_notice: Option<StartupNoticeSnapshot>,
    pub value: T,
}

struct StorageNoticeMessages {
    recovered_from_backup: &'static str,
    reset_to_defaults: &'static str,
}

#[cfg(test)]
pub fn load_app_settings(path: &Path) -> AppResult<AppSettings> {
    load_app_settings_with_status(path).map(|outcome| outcome.value)
}

#[cfg(test)]
pub fn load_store_snapshot(path: &Path) -> AppResult<StoreSnapshot> {
    load_store_snapshot_with_status(path).map(|outcome| outcome.value)
}

/// Loads app settings. Missing or unreadable files fall back to backup, then defaults.
pub fn load_app_settings_with_status(path: &Path) -> AppResult<LoadOutcome<AppSettings>> {
    load_with_fallback(
        path,
        decode_settings,
        AppSettings::default,
        StorageNoticeMessages {
            recovered_from_backup: "診断設定をバックアップから復旧しました。",
            reset_to_defaults: "診断設定を復旧できなかったため既定値で起動しました。",
        },
    )
}

/// Loads the store snapshot. Missing or unreadable files fall back to backup, then seeded data.
pub fn load_store_snapshot_with_status(path: &Path) -> AppResult<LoadOutcome<StoreSnapshot>> {
    load_with_fallback(
        path,
        decode_store_snapshot,
        StoreSnapshot::seeded,
        StorageNoticeMessages {
            recovered_from_backup: "ローカルデータをバックアップから復旧しました。",
            reset_to_defaults: "ローカルデータを復旧できなかったため初期状態で起動しました。",
        },
    )
}

/// Writes app settings with the current storage document format.
///
/// # Errors
///
/// Returns an error if settings cannot be encoded or written atomically.
pub fn write_app_settings(path: &Path, settings: &AppSettings) -> AppResult<()> {
    let content = encode_settings(settings)?;
    write_json_safely(path, &content)
}

/// Writes the store snapshot with the current storage document format.
///
/// # Errors
///
/// Returns an error if the snapshot cannot be encoded or written atomically.
pub fn write_store_snapshot(path: &Path, snapshot: &StoreSnapshot) -> AppResult<()> {
    let content = encode_store_snapshot(snapshot)?;
    write_json_safely(path, &content)
}

fn load_with_fallback<T>(
    path: &Path,
    decode: impl Fn(&str) -> AppResult<T>,
    default: impl Fn() -> T,
    notices: StorageNoticeMessages,
) -> AppResult<LoadOutcome<T>> {
    if !path.exists() {
        let backup_path = backup_path(path);
        if backup_path.exists() {
            return match read_and_decode(&backup_path, &decode) {
                Ok(value) => {
                    eprintln!("MailDraft storage recovered from backup because the primary file was missing.");
                    Ok(LoadOutcome {
                        startup_notice: Some(StartupNoticeSnapshot {
                            message: notices.recovered_from_backup.to_string(),
                            tone: StartupNoticeTone::Notice,
                        }),
                        value,
                    })
                }
                Err(error) => {
                    quarantine_file(&backup_path);
                    eprintln!(
                        "MailDraft storage backup was unreadable when the primary file was missing: {}",
                        error
                    );
                    Ok(LoadOutcome {
                        startup_notice: Some(StartupNoticeSnapshot {
                            message: notices.reset_to_defaults.to_string(),
                            tone: StartupNoticeTone::Warning,
                        }),
                        value: default(),
                    })
                }
            };
        }

        return Ok(LoadOutcome {
            startup_notice: None,
            value: default(),
        });
    }

    match read_and_decode(path, &decode) {
        Ok(value) => Ok(LoadOutcome {
            startup_notice: None,
            value,
        }),
        Err(main_error) => {
            let backup_path = backup_path(path);
            if backup_path.exists() {
                match read_and_decode(&backup_path, &decode) {
                    Ok(value) => {
                        quarantine_file(path);
                        eprintln!(
                            "MailDraft storage recovered from backup after primary load failed: {}",
                            main_error
                        );
                        return Ok(LoadOutcome {
                            startup_notice: Some(StartupNoticeSnapshot {
                                message: notices.recovered_from_backup.to_string(),
                                tone: StartupNoticeTone::Notice,
                            }),
                            value,
                        });
                    }
                    Err(backup_error) => {
                        quarantine_file(&backup_path);
                        eprintln!(
                            "MailDraft storage backup was unreadable after primary load failed: {} / {}",
                            main_error, backup_error
                        );
                    }
                }
            } else {
                eprintln!(
                    "MailDraft storage fell back to defaults after primary load failed: {}",
                    main_error
                );
            }

            quarantine_file(path);
            Ok(LoadOutcome {
                startup_notice: Some(StartupNoticeSnapshot {
                    message: notices.reset_to_defaults.to_string(),
                    tone: StartupNoticeTone::Warning,
                }),
                value: default(),
            })
        }
    }
}

fn read_and_decode<T>(path: &Path, decode: impl Fn(&str) -> AppResult<T>) -> AppResult<T> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    decode(&content)
}

fn quarantine_file(path: &Path) {
    if !path.exists() {
        return;
    }

    let _ = fs::rename(path, corrupt_path(path));
}

pub(super) fn backup_path(path: &Path) -> PathBuf {
    with_suffix(path, ".bak")
}

fn corrupt_path(path: &Path) -> PathBuf {
    with_suffix(path, &format!(".corrupt-{}", now_unix_millis()))
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("maildraft-data");
    path.with_file_name(format!("{}{}", file_name, suffix))
}

pub(super) fn now_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use pretty_assertions::assert_eq;
    use serde_json::{json, Value};
    use tempfile::tempdir;

    use super::{
        backup_path, load_app_settings, load_app_settings_with_status, load_store_snapshot,
        load_store_snapshot_with_status, write_app_settings, write_store_snapshot,
        StartupNoticeSnapshot, StartupNoticeTone,
    };
    use crate::{
        app::settings::{AppSettings, LoggingMode, LoggingSettings},
        modules::store::StoreSnapshot,
    };

    #[test]
    fn store_round_trips_current_document_and_creates_backup_on_update() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-store.json");
        let snapshot = StoreSnapshot::seeded();

        write_store_snapshot(&path, &snapshot).expect("write initial store");
        let first: Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read first")).expect("json");
        assert_eq!(first["app"], json!("maildraft"));
        assert_eq!(first["version"], json!(1));
        assert_eq!(first["snapshot"]["drafts"][0]["id"], json!("draft-welcome"));

        let mut next_snapshot = snapshot.clone();
        next_snapshot.drafts[0].title = "更新した下書き".to_string();
        write_store_snapshot(&path, &next_snapshot).expect("write updated store");

        let backup: Value =
            serde_json::from_str(&fs::read_to_string(backup_path(&path)).expect("read backup"))
                .expect("backup json");
        assert_eq!(
            backup["snapshot"]["drafts"][0]["title"],
            json!("最初の下書き")
        );
    }

    #[test]
    fn load_store_snapshot_accepts_legacy_snapshot_and_future_version_is_rejected() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-store.json");

        fs::write(
            &path,
            serde_json::to_string(&StoreSnapshot::seeded()).expect("legacy json"),
        )
        .expect("write legacy store");
        let loaded = load_store_snapshot(&path).expect("load legacy store");
        assert_eq!(loaded.drafts[0].id, "draft-welcome");

        fs::write(
            &path,
            serde_json::to_string(&json!({
                "app": "maildraft",
                "version": 9,
                "savedAtMs": 0,
                "snapshot": StoreSnapshot::seeded(),
            }))
            .expect("future json"),
        )
        .expect("write future store");
        fs::write(
            backup_path(&path),
            serde_json::to_string(&StoreSnapshot::seeded()).expect("backup json"),
        )
        .expect("write backup");
        let recovered = load_store_snapshot_with_status(&path).expect("recover from backup");
        assert_eq!(
            recovered.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "ローカルデータをバックアップから復旧しました。".to_string(),
                tone: StartupNoticeTone::Notice,
            })
        );
        let recovered = recovered.value;
        assert_eq!(recovered.drafts[0].id, "draft-welcome");
    }

    #[test]
    fn broken_store_without_backup_is_quarantined_and_seeded() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-store.json");
        fs::write(&path, "{broken").expect("write broken store");

        let loaded = load_store_snapshot_with_status(&path).expect("fallback to seeded");
        assert_eq!(
            loaded.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "ローカルデータを復旧できなかったため初期状態で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            })
        );
        let loaded = loaded.value;
        assert_eq!(loaded.drafts[0].id, "draft-welcome");
        assert!(!path.exists());
        assert!(fs::read_dir(directory.path())
            .expect("read dir")
            .any(|entry| entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .starts_with("maildraft-store.json.corrupt-")));
    }

    #[test]
    fn missing_primary_with_broken_backup_quarantines_backup_and_seeds_store() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-store.json");
        fs::write(backup_path(&path), "{broken-backup").expect("write broken backup");

        let loaded = load_store_snapshot_with_status(&path).expect("default after broken backup");

        assert_eq!(
            loaded.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "ローカルデータを復旧できなかったため初期状態で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            })
        );
        assert_eq!(loaded.value.drafts[0].id, "draft-welcome");
        assert!(!backup_path(&path).exists());
        assert!(fs::read_dir(directory.path())
            .expect("read dir")
            .any(|entry| entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .starts_with("maildraft-store.json.bak.corrupt-")));
    }

    #[test]
    fn broken_primary_and_backup_are_both_quarantined_before_store_defaults() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-store.json");
        fs::write(&path, "{broken-primary").expect("write broken primary");
        fs::write(backup_path(&path), "{broken-backup").expect("write broken backup");

        let loaded = load_store_snapshot_with_status(&path).expect("fallback to seeded");

        assert_eq!(
            loaded.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "ローカルデータを復旧できなかったため初期状態で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            })
        );
        assert_eq!(loaded.value.drafts[0].id, "draft-welcome");
        assert!(!path.exists());
        assert!(!backup_path(&path).exists());
        let quarantined = fs::read_dir(directory.path())
            .expect("read dir")
            .map(|entry| {
                entry
                    .expect("entry")
                    .file_name()
                    .to_string_lossy()
                    .to_string()
            })
            .collect::<Vec<_>>();
        assert!(quarantined
            .iter()
            .any(|name| name.starts_with("maildraft-store.json.corrupt-")));
        assert!(quarantined
            .iter()
            .any(|name| name.starts_with("maildraft-store.json.bak.corrupt-")));
    }

    #[test]
    fn settings_round_trip_and_accept_legacy_settings() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-settings.json");
        let settings = AppSettings {
            logging: LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 30,
            },
        };

        write_app_settings(&path, &settings).expect("write settings");
        let stored: Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read settings")).expect("json");
        assert_eq!(stored["app"], json!("maildraft"));
        assert_eq!(stored["settings"]["logging"]["mode"], json!("standard"));

        fs::write(
            &path,
            serde_json::to_string(&settings).expect("legacy settings"),
        )
        .expect("rewrite legacy settings");
        let loaded = load_app_settings(&path).expect("load legacy settings");
        assert_eq!(loaded.logging.mode, LoggingMode::Standard);
        assert_eq!(loaded.logging.retention_days, 30);
    }

    #[test]
    fn broken_settings_fall_back_to_backup_then_defaults() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-settings.json");
        fs::write(&path, "{broken").expect("write broken settings");
        fs::write(
            backup_path(&path),
            serde_json::to_string(&AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
            })
            .expect("backup settings"),
        )
        .expect("write settings backup");

        let recovered = load_app_settings_with_status(&path).expect("recover settings backup");
        assert_eq!(
            recovered.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "診断設定をバックアップから復旧しました。".to_string(),
                tone: StartupNoticeTone::Notice,
            })
        );
        let recovered = recovered.value;
        assert_eq!(recovered.logging.mode, LoggingMode::Standard);

        fs::write(&path, "{broken-again").expect("write broken settings again");
        fs::write(backup_path(&path), "{broken-backup").expect("write broken backup");
        let defaulted = load_app_settings_with_status(&path).expect("default settings");
        assert_eq!(
            defaulted.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "診断設定を復旧できなかったため既定値で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            })
        );
        let defaulted = defaulted.value;
        assert_eq!(defaulted.logging.mode, LoggingMode::ErrorsOnly);
        assert_eq!(defaulted.logging.retention_days, 14);
    }

    #[test]
    fn missing_primary_with_broken_backup_quarantines_backup_and_defaults_settings() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-settings.json");
        fs::write(backup_path(&path), "{broken-backup").expect("write broken backup");

        let loaded = load_app_settings_with_status(&path).expect("default settings");

        assert_eq!(
            loaded.startup_notice,
            Some(StartupNoticeSnapshot {
                message: "診断設定を復旧できなかったため既定値で起動しました。".to_string(),
                tone: StartupNoticeTone::Warning,
            })
        );
        assert_eq!(loaded.value.logging.mode, LoggingMode::ErrorsOnly);
        assert!(!backup_path(&path).exists());
        assert!(fs::read_dir(directory.path())
            .expect("read dir")
            .any(|entry| entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .starts_with("maildraft-settings.json.bak.corrupt-")));
    }
}

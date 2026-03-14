mod atomic_write;
mod settings_document;
mod store_document;

use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{app::settings::AppSettings, modules::store::StoreSnapshot};

use self::{
    atomic_write::write_json_safely,
    settings_document::{decode_settings, encode_settings},
    store_document::{decode_store_snapshot, encode_store_snapshot},
};

type AppResult<T> = Result<T, String>;

pub const STORAGE_DOCUMENT_APP: &str = "maildraft";

pub fn load_app_settings(path: &Path) -> AppResult<AppSettings> {
    load_with_fallback(path, decode_settings, AppSettings::default)
}

pub fn load_store_snapshot(path: &Path) -> AppResult<StoreSnapshot> {
    load_with_fallback(path, decode_store_snapshot, StoreSnapshot::seeded)
}

pub fn write_app_settings(path: &Path, settings: &AppSettings) -> AppResult<()> {
    let content = encode_settings(settings)?;
    write_json_safely(path, &content)
}

pub fn write_store_snapshot(path: &Path, snapshot: &StoreSnapshot) -> AppResult<()> {
    let content = encode_store_snapshot(snapshot)?;
    write_json_safely(path, &content)
}

fn load_with_fallback<T>(
    path: &Path,
    decode: impl Fn(&str) -> AppResult<T>,
    default: impl Fn() -> T,
) -> AppResult<T> {
    if !path.exists() {
        let backup_path = backup_path(path);
        if backup_path.exists() {
            return match read_and_decode(&backup_path, &decode) {
                Ok(value) => {
                    eprintln!("MailDraft storage recovered from backup because the primary file was missing.");
                    Ok(value)
                }
                Err(error) => {
                    quarantine_file(&backup_path);
                    eprintln!(
                        "MailDraft storage backup was unreadable when the primary file was missing: {}",
                        error
                    );
                    Ok(default())
                }
            };
        }

        return Ok(default());
    }

    match read_and_decode(path, &decode) {
        Ok(value) => Ok(value),
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
                        return Ok(value);
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
            Ok(default())
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
        backup_path, load_app_settings, load_store_snapshot, write_app_settings,
        write_store_snapshot,
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
        let recovered = load_store_snapshot(&path).expect("recover from backup");
        assert_eq!(recovered.drafts[0].id, "draft-welcome");
    }

    #[test]
    fn broken_store_without_backup_is_quarantined_and_seeded() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft-store.json");
        fs::write(&path, "{broken").expect("write broken store");

        let loaded = load_store_snapshot(&path).expect("fallback to seeded");
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

        let recovered = load_app_settings(&path).expect("recover settings backup");
        assert_eq!(recovered.logging.mode, LoggingMode::Standard);

        fs::write(&path, "{broken-again").expect("write broken settings again");
        fs::write(backup_path(&path), "{broken-backup").expect("write broken backup");
        let defaulted = load_app_settings(&path).expect("default settings");
        assert_eq!(defaulted.logging.mode, LoggingMode::ErrorsOnly);
        assert_eq!(defaulted.logging.retention_days, 14);
    }
}

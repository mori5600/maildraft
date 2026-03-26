use std::path::Path;

use crate::{
    app::settings::AppSettings,
    modules::store::StoreSnapshot,
};

use super::{
    paths::{backup_path, quarantine_file},
    settings_document::decode_settings,
    store_document::decode_store_snapshot,
    AppResult, LoadOutcome, StartupNoticeSnapshot, StartupNoticeTone,
};
use crate::app::validation::{
    read_text_file_with_limit, validate_app_settings, validate_store_snapshot,
    MAX_SETTINGS_FILE_BYTES, MAX_STORE_FILE_BYTES,
};

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
        |content| {
            let settings = decode_settings(content)?;
            validate_app_settings(&settings)?;
            Ok(settings)
        },
        AppSettings::default,
        StorageNoticeMessages {
            recovered_from_backup: "設定をバックアップから復旧しました。",
            reset_to_defaults: "設定を復旧できなかったため既定値で起動しました。",
        },
        MAX_SETTINGS_FILE_BYTES,
    )
}

/// Loads the store snapshot. Missing or unreadable files fall back to backup, then seeded data.
pub fn load_store_snapshot_with_status(path: &Path) -> AppResult<LoadOutcome<StoreSnapshot>> {
    load_with_fallback(
        path,
        |content| {
            let mut snapshot = decode_store_snapshot(content)?;
            snapshot.ensure_consistency();
            validate_store_snapshot(&snapshot)?;
            Ok(snapshot)
        },
        StoreSnapshot::seeded,
        StorageNoticeMessages {
            recovered_from_backup: "ローカルデータをバックアップから復旧しました。",
            reset_to_defaults: "ローカルデータを復旧できなかったため初期状態で起動しました。",
        },
        MAX_STORE_FILE_BYTES,
    )
}

fn load_with_fallback<T>(
    path: &Path,
    decode: impl Fn(&str) -> AppResult<T>,
    default: impl Fn() -> T,
    notices: StorageNoticeMessages,
    max_bytes: u64,
) -> AppResult<LoadOutcome<T>> {
    if !path.exists() {
        let backup_path = backup_path(path);
        if backup_path.exists() {
            return match read_and_decode(&backup_path, max_bytes, &decode) {
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

    match read_and_decode(path, max_bytes, &decode) {
        Ok(value) => Ok(LoadOutcome {
            startup_notice: None,
            value,
        }),
        Err(main_error) => {
            let backup_path = backup_path(path);
            if backup_path.exists() {
                match read_and_decode(&backup_path, max_bytes, &decode) {
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

fn read_and_decode<T>(
    path: &Path,
    max_bytes: u64,
    decode: impl Fn(&str) -> AppResult<T>,
) -> AppResult<T> {
    let too_large_message = if max_bytes == MAX_SETTINGS_FILE_BYTES {
        "設定ファイルが大きすぎます。"
    } else {
        "保存ファイルが大きすぎます。"
    };
    let content = read_text_file_with_limit(path, max_bytes, too_large_message)?;
    decode(&content)
}

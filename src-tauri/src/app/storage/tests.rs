use std::fs;

use pretty_assertions::assert_eq;
use serde_json::{json, Value};
use tempfile::tempdir;

use super::{
    load_app_settings, load_app_settings_with_status, load_store_snapshot,
    load_store_snapshot_with_status, write_app_settings, write_store_snapshot,
    StartupNoticeSnapshot, StartupNoticeTone, paths::backup_path,
};
use crate::{
    app::settings::{AppSettings, LoggingMode, LoggingSettings, ProofreadingSettings},
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
fn duplicate_store_ids_fall_back_to_backup() {
    let directory = tempdir().expect("tempdir");
    let path = directory.path().join("maildraft-store.json");
    let mut invalid = StoreSnapshot::seeded();
    invalid
        .trash
        .drafts
        .push(crate::modules::trash::TrashedDraft {
            draft: invalid.drafts[0].clone(),
            history: Vec::new(),
            deleted_at: "1".to_string(),
        });
    fs::write(
        &path,
        serde_json::to_string(&invalid).expect("serialize invalid store"),
    )
    .expect("write invalid store");
    fs::write(
        backup_path(&path),
        serde_json::to_string(&StoreSnapshot::seeded()).expect("serialize backup"),
    )
    .expect("write backup");

    let loaded = load_store_snapshot_with_status(&path).expect("recover from backup");
    assert_eq!(
        loaded.startup_notice,
        Some(StartupNoticeSnapshot {
            message: "ローカルデータをバックアップから復旧しました。".to_string(),
            tone: StartupNoticeTone::Notice,
        })
    );
    assert_eq!(loaded.value.trash.item_count(), 0);
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
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec![" whitespace.trailing ".to_string(), "prh".to_string()],
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
    assert_eq!(
        loaded.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
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
            proofreading: ProofreadingSettings {
                disabled_rule_ids: vec!["prh".to_string()],
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
    assert_eq!(
        recovered.proofreading.disabled_rule_ids,
        vec!["prh".to_string()]
    );

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
    assert!(defaulted.proofreading.disabled_rule_ids.is_empty());
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

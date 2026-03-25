use super::*;

#[test]
fn load_settings_defaults_missing_files_and_normalizes_saved_values() {
    let directory = tempdir().expect("tempdir");
    let missing_path = directory.path().join("missing.json");

    let default_settings = load_app_settings(&missing_path).expect("default settings");
    assert_eq!(default_settings.logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(default_settings.logging.retention_days, 14);
    assert!(default_settings.proofreading.disabled_rule_ids.is_empty());

    let saved_path = directory.path().join("settings.json");
    let content = serde_json::to_string(&AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 99,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec![" prh ".to_string(), "whitespace.trailing".to_string()],
        },
    })
    .expect("serialize settings");
    fs::write(&saved_path, content).expect("write settings");

    let loaded = load_app_settings(&saved_path).expect("load settings");
    assert_eq!(loaded.logging.mode, LoggingMode::Standard);
    assert_eq!(loaded.logging.retention_days, 14);
    assert_eq!(
        loaded.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn load_startup_notice_reports_recovery_and_default_fallback() {
    let directory = tempdir().expect("tempdir");
    let store_path = directory.path().join("maildraft-store.json");
    let settings_path = directory.path().join("maildraft-settings.json");

    fs::write(&store_path, "{broken-store").expect("write broken store");
    fs::write(
        backup_path(&store_path),
        serde_json::to_string(&StoreSnapshot::seeded()).expect("store backup"),
    )
    .expect("write store backup");
    fs::write(&settings_path, "{broken-settings").expect("write broken settings");
    fs::write(backup_path(&settings_path), "{broken-settings-backup")
        .expect("write broken settings backup");

    let state = AppState::new_for_tests(directory.path()).expect("state with startup notice");
    let notice = state
        .load_startup_notice()
        .expect("load startup notice")
        .expect("startup notice");

    assert_eq!(notice.tone, StartupNoticeTone::Warning);
    assert_eq!(
        notice.message,
        "診断設定を復旧できなかったため既定値で起動しました。 ローカルデータをバックアップから復旧しました。"
    );
}

#[test]
fn load_startup_notice_is_empty_for_clean_boot() {
    let (state, _directory) = make_state();

    assert_eq!(
        state.load_startup_notice().expect("load startup notice"),
        None
    );
}

#[test]
fn runtime_startup_migrates_legacy_json_documents_into_sqlite() {
    let directory = tempdir().expect("tempdir");
    let root = directory.path();
    let store_path = root.join("maildraft-store.json");
    let settings_path = root.join("maildraft-settings.json");
    let sqlite_path = root.join("maildraft.sqlite3");

    let mut legacy_snapshot = StoreSnapshot::seeded();
    legacy_snapshot.drafts[0].title = "json migrated draft".to_string();
    legacy_snapshot.templates[0].name = "json migrated template".to_string();
    legacy_snapshot.ensure_consistency();
    let legacy_settings = AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec!["prh".to_string()],
        },
    };

    write_store_snapshot(&store_path, &legacy_snapshot).expect("write legacy store");
    write_app_settings(&settings_path, &legacy_settings).expect("write legacy settings");
    let normalized_legacy_settings = legacy_settings.clone().normalized();

    let state = AppState::new_for_runtime_tests(root).expect("runtime state");
    let startup_notice = state
        .load_startup_notice()
        .expect("load startup notice")
        .expect("migration notice");

    assert_eq!(
        serde_json::to_value(state.load_snapshot().expect("runtime snapshot"))
            .expect("serialize runtime snapshot"),
        serde_json::to_value(&legacy_snapshot).expect("serialize legacy snapshot"),
    );
    assert_eq!(
        settings_value(&state),
        serde_json::to_value(&normalized_legacy_settings).expect("serialize legacy settings"),
    );
    assert_eq!(
        serde_json::to_value(read_sqlite_store(&sqlite_path)).expect("serialize sqlite store"),
        serde_json::to_value(&legacy_snapshot).expect("serialize legacy snapshot"),
    );
    assert_eq!(
        serde_json::to_value(read_sqlite_settings(&sqlite_path))
            .expect("serialize sqlite settings"),
        serde_json::to_value(&normalized_legacy_settings).expect("serialize legacy settings"),
    );
    assert_eq!(startup_notice.tone, StartupNoticeTone::Notice);
    assert!(startup_notice.message.contains("SQLite へ移行しました。"));
}

#[test]
fn runtime_startup_prefers_existing_sqlite_over_legacy_json() {
    let directory = tempdir().expect("tempdir");
    let root = directory.path();
    let store_path = root.join("maildraft-store.json");
    let settings_path = root.join("maildraft-settings.json");
    let sqlite_path = root.join("maildraft.sqlite3");

    let mut legacy_snapshot = StoreSnapshot::seeded();
    legacy_snapshot.drafts[0].title = "legacy json".to_string();
    let legacy_settings = AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Off,
            retention_days: 14,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec!["prh".to_string()],
        },
    };
    write_store_snapshot(&store_path, &legacy_snapshot).expect("write legacy store");
    write_app_settings(&settings_path, &legacy_settings).expect("write legacy settings");

    let mut sqlite_snapshot = StoreSnapshot::seeded();
    sqlite_snapshot.drafts[0].title = "sqlite runtime".to_string();
    sqlite_snapshot.ensure_consistency();
    let sqlite_settings = AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec!["whitespace.trailing".to_string()],
        },
    };
    SqliteRepository::new(sqlite_path.clone())
        .save_full_state(&sqlite_snapshot, &sqlite_settings)
        .expect("save sqlite state");

    let state = AppState::new_for_runtime_tests(root).expect("runtime state");

    assert_eq!(
        serde_json::to_value(state.load_snapshot().expect("runtime snapshot"))
            .expect("serialize runtime snapshot"),
        serde_json::to_value(&sqlite_snapshot).expect("serialize sqlite snapshot"),
    );
    assert_eq!(
        settings_value(&state),
        serde_json::to_value(sqlite_settings.normalized()).expect("serialize sqlite settings"),
    );
    assert_eq!(state.load_startup_notice().expect("startup notice"), None);
}

#[test]
fn runtime_startup_fails_when_existing_sqlite_is_unavailable() {
    let directory = tempdir().expect("tempdir");
    let root = directory.path();
    let store_path = root.join("maildraft-store.json");
    let settings_path = root.join("maildraft-settings.json");
    let sqlite_path = root.join("maildraft.sqlite3");

    let mut legacy_snapshot = StoreSnapshot::seeded();
    legacy_snapshot.drafts[0].title = "json fallback".to_string();
    let legacy_settings = AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec!["prh".to_string()],
        },
    };
    write_store_snapshot(&store_path, &legacy_snapshot).expect("write legacy store");
    write_app_settings(&settings_path, &legacy_settings).expect("write legacy settings");
    fs::create_dir_all(&sqlite_path).expect("block sqlite path with directory");

    let error = AppState::new_for_runtime_tests(root)
        .err()
        .expect("runtime startup should fail");
    assert!(error.contains("既存の SQLite データベースを開けませんでした。"));
}

#[test]
fn runtime_startup_fails_when_existing_empty_sqlite_conflicts_with_legacy_json() {
    let directory = tempdir().expect("tempdir");
    let root = directory.path();
    let store_path = root.join("maildraft-store.json");
    let settings_path = root.join("maildraft-settings.json");
    let sqlite_path = root.join("maildraft.sqlite3");

    let legacy_snapshot = StoreSnapshot::seeded();
    let legacy_settings = AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec!["prh".to_string()],
        },
    };
    write_store_snapshot(&store_path, &legacy_snapshot).expect("write legacy store");
    write_app_settings(&settings_path, &legacy_settings).expect("write legacy settings");
    let connection = rusqlite::Connection::open(&sqlite_path).expect("create sqlite file");
    drop(connection);

    let error = AppState::new_for_runtime_tests(root)
        .err()
        .expect("runtime startup should fail");
    assert!(error.contains("既存の SQLite データベースと従来の JSON データが競合しています。"));
}

#[test]
fn runtime_startup_fails_when_existing_sqlite_schema_is_newer_than_supported() {
    let directory = tempdir().expect("tempdir");
    let root = directory.path();
    let sqlite_path = root.join("maildraft.sqlite3");
    let connection = rusqlite::Connection::open(&sqlite_path).expect("create sqlite");
    connection
        .pragma_update(None, "user_version", 999)
        .expect("set sqlite schema version");
    drop(connection);

    let error = AppState::new_for_runtime_tests(root)
        .err()
        .expect("runtime startup should fail");
    assert!(error.contains("既存の SQLite データベースを開けませんでした。"));
    assert!(error.contains("SQLite スキーマのバージョンが新しすぎます。"));
}

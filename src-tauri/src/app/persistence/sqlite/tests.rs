use pretty_assertions::assert_eq;
use tempfile::tempdir;

use super::{
    connection::{settings_initialized, store_initialized},
    read::load_store_snapshot,
    write::{insert_store_snapshot, set_initialization_flags},
    SqliteRepository,
};
use crate::{
    app::{
        persistence::PersistenceRepository,
        settings::{AppSettings, LoggingMode, LoggingSettings, ProofreadingSettings},
    },
    modules::{store::StoreSnapshot, trash::TrashedDraft},
};

#[test]
fn sqlite_repository_round_trips_store_and_settings() {
    let directory = tempdir().expect("tempdir");
    let db_path = directory.path().join("maildraft.sqlite3");
    let repository = SqliteRepository::new(db_path);

    let mut snapshot = StoreSnapshot::seeded();
    snapshot.templates[0].signature_id = snapshot
        .trash
        .signatures
        .first()
        .map(|entry| entry.signature.id.clone());
    snapshot.trash.drafts.push(TrashedDraft {
        draft: snapshot.drafts[0].clone(),
        history: snapshot.draft_history.clone(),
        deleted_at: "999".to_string(),
    });
    snapshot.drafts.retain(|draft| draft.id != "draft-welcome");
    snapshot.draft_history.clear();
    snapshot.ensure_consistency();

    let settings = AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        proofreading: ProofreadingSettings {
            disabled_rule_ids: vec!["prh".to_string(), "whitespace.trailing".to_string()],
        },
    };

    repository
        .save_store_snapshot(&snapshot)
        .expect("save store snapshot");
    repository
        .save_app_settings(&settings)
        .expect("save settings");

    let loaded_store = repository
        .load_store_snapshot()
        .expect("load store snapshot")
        .value;
    let loaded_settings = repository.load_app_settings().expect("load settings").value;

    assert_eq!(
        serde_json::to_value(&loaded_store).expect("serialize loaded store"),
        serde_json::to_value(&snapshot).expect("serialize original store"),
    );
    assert_eq!(
        serde_json::to_value(&loaded_settings).expect("serialize loaded settings"),
        serde_json::to_value(settings.normalized()).expect("serialize original settings"),
    );
}

#[test]
fn sqlite_repository_initializes_schema_only_once() {
    let directory = tempdir().expect("tempdir");
    let db_path = directory.path().join("maildraft.sqlite3");
    let repository = SqliteRepository::new(db_path);

    let connection = repository
        .open_connection_for_tests()
        .expect("open connection");
    let version = connection
        .pragma_query_value(None, "user_version", |row| row.get::<_, i32>(0))
        .expect("query user version");
    assert_eq!(version, 1);
    assert!(!store_initialized(&connection).expect("store initialized"));
    assert!(!settings_initialized(&connection).expect("settings initialized"));

    drop(connection);
    repository
        .open_connection_for_tests()
        .expect("reopen connection after migrations");
}

#[test]
fn sqlite_schema_enforces_unique_active_default_signature_and_history_scope() {
    let directory = tempdir().expect("tempdir");
    let db_path = directory.path().join("maildraft.sqlite3");
    let repository = SqliteRepository::new(db_path);
    let connection = repository
        .open_connection_for_tests()
        .expect("open connection");

    connection
        .execute(
            r#"
            INSERT INTO signatures (
                id, name, is_pinned, body, is_default, created_at, updated_at, in_trash,
                deleted_at, sort_order
            ) VALUES ('sig-1', '標準', 0, 'body', 1, '1', '1', 0, NULL, 0)
            "#,
            [],
        )
        .expect("insert first default signature");
    let signature_error = connection
        .execute(
            r#"
            INSERT INTO signatures (
                id, name, is_pinned, body, is_default, created_at, updated_at, in_trash,
                deleted_at, sort_order
            ) VALUES ('sig-2', '営業', 0, 'body', 1, '1', '1', 0, NULL, 1)
            "#,
            [],
        )
        .unwrap_err()
        .to_string();
    assert!(signature_error.contains("UNIQUE"));

    connection
        .execute(
            r#"
            INSERT INTO drafts (
                id, title, is_pinned, subject, recipient, opening, body, closing, template_id,
                signature_id, created_at, updated_at, in_trash, deleted_at, sort_order
            ) VALUES ('draft-1', '下書き', 0, '', '', '', '', '', NULL, NULL, '1', '1', 0, NULL, 0)
            "#,
            [],
        )
        .expect("insert active draft");
    let history_error = connection
        .execute(
            r#"
            INSERT INTO draft_history_trashed (
                id, draft_id, title, subject, recipient, opening, body, closing, template_id,
                signature_id, recorded_at, sort_order
            ) VALUES ('history-1', 'draft-1', '履歴', '', '', '', '', '', NULL, NULL, '1', 0)
            "#,
            [],
        )
        .unwrap_err()
        .to_string();
    assert!(history_error.contains("trashed_history_requires_trashed_draft"));
}

#[test]
fn sqlite_repository_loads_seed_defaults_when_database_has_no_saved_state() {
    let directory = tempdir().expect("tempdir");
    let db_path = directory.path().join("maildraft.sqlite3");
    let repository = SqliteRepository::new(db_path);

    let store = repository
        .load_store_snapshot()
        .expect("load default store")
        .value;
    let settings = repository
        .load_app_settings()
        .expect("load default settings")
        .value;

    assert_eq!(
        serde_json::to_value(store).expect("serialize store"),
        serde_json::to_value(StoreSnapshot::seeded()).expect("serialize seeded store"),
    );
    assert_eq!(settings.logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(settings.logging.retention_days, 14);
    assert!(settings.proofreading.disabled_rule_ids.is_empty());
}

#[test]
fn sqlite_load_helpers_reconstruct_snapshot_from_raw_tables() {
    let directory = tempdir().expect("tempdir");
    let db_path = directory.path().join("maildraft.sqlite3");
    let repository = SqliteRepository::new(db_path);
    let mut connection = repository
        .open_connection_for_tests()
        .expect("open connection");
    let transaction = connection.transaction().expect("transaction");
    let snapshot = StoreSnapshot::seeded();
    insert_store_snapshot(&transaction, &snapshot).expect("insert snapshot");
    set_initialization_flags(&transaction, Some(true), None).expect("mark initialized");
    transaction.commit().expect("commit");

    let loaded = load_store_snapshot(&connection).expect("load raw snapshot");
    assert_eq!(
        serde_json::to_value(&loaded).expect("serialize loaded"),
        serde_json::to_value(&snapshot).expect("serialize snapshot"),
    );
}

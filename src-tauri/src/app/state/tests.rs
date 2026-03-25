use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use pretty_assertions::assert_eq;
use serde_json::{json, Value};
use tempfile::tempdir;

use super::{
    context::{
        draft_context, logging_settings_context, memo_context, merge_context,
        proofreading_settings_context, snapshot_counts_context, template_context,
        trash_kind_context, variable_preset_context,
    },
    AppState,
};
use crate::{
    app::{
        backup::{decode_backup_document, BackupDocument},
        logging::{LogEntry, LogLevel},
        persistence::{sqlite::SqliteRepository, PersistenceRepository},
        settings::{
            AppSettings, LoggingMode, LoggingSettings, LoggingSettingsInput, ProofreadingSettings,
            ProofreadingSettingsInput,
        },
        storage::{
            load_app_settings, load_store_snapshot, write_app_settings, write_store_snapshot,
            StartupNoticeTone,
        },
        validation::MAX_BACKUP_FILE_BYTES,
    },
    modules::{
        drafts::DraftInput,
        memo::{Memo, MemoInput},
        signatures::SignatureInput,
        store::StoreSnapshot,
        templates::TemplateInput,
        variable_presets::VariablePresetInput,
    },
};

fn make_state() -> (AppState, tempfile::TempDir) {
    let directory = tempdir().expect("tempdir");
    let state = AppState::new_for_tests(directory.path()).expect("state");
    (state, directory)
}

fn make_runtime_state() -> (AppState, tempfile::TempDir) {
    let directory = tempdir().expect("tempdir");
    let state = AppState::new_for_runtime_tests(directory.path()).expect("runtime state");
    (state, directory)
}

fn read_store(path: &Path) -> StoreSnapshot {
    load_store_snapshot(path).expect("store snapshot")
}

fn read_settings_file(path: &Path) -> AppSettings {
    load_app_settings(path).expect("settings file")
}

fn read_sqlite_store(path: &Path) -> StoreSnapshot {
    SqliteRepository::new(path.to_path_buf())
        .load_store_snapshot()
        .expect("sqlite store snapshot")
        .value
}

fn read_sqlite_settings(path: &Path) -> AppSettings {
    SqliteRepository::new(path.to_path_buf())
        .load_app_settings()
        .expect("sqlite settings")
        .value
}

fn runtime_database_path(root: &Path) -> PathBuf {
    root.join("maildraft.sqlite3")
}

fn store_file_path(state: &AppState) -> std::path::PathBuf {
    state.store_document_path_for_tests()
}

fn settings_file_path(state: &AppState) -> std::path::PathBuf {
    state.settings_document_path_for_tests()
}

fn backup_path(path: &Path) -> std::path::PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .expect("backup file name");
    path.with_file_name(format!("{}.bak", file_name))
}

fn snapshot_value(state: &AppState) -> Value {
    serde_json::to_value(state.load_snapshot().expect("load snapshot")).expect("serialize snapshot")
}

fn settings_value(state: &AppState) -> Value {
    let settings = state.settings.lock().expect("settings lock").clone();
    serde_json::to_value(settings).expect("serialize settings")
}

fn block_store_persistence(state: &mut AppState, directory: &Path, name: &str) {
    let blocked_path = directory.join(name);
    fs::create_dir_all(&blocked_path).expect("create blocked store path");
    let settings_path = settings_file_path(state);
    state.replace_json_repository_for_tests(blocked_path, settings_path);
}

fn block_settings_persistence(state: &mut AppState, directory: &Path, name: &str) {
    let blocked_path = directory.join(name);
    fs::create_dir_all(&blocked_path).expect("create blocked settings path");
    let store_path = store_file_path(state);
    state.replace_json_repository_for_tests(store_path, blocked_path);
}

fn replace_logs_directory_with_file(root: &Path) {
    let logs_path = root.join("logs");
    if logs_path.exists() {
        fs::remove_dir_all(&logs_path).expect("remove logs dir");
    }
    fs::write(&logs_path, "blocked").expect("block logs path");
}

fn assert_store_operation_rolls_back_on_persist_failure<T>(
    state: &mut AppState,
    directory: &Path,
    blocked_name: &str,
    operation: impl FnOnce(&AppState) -> Result<T, String>,
) {
    let original_store_path = store_file_path(state);
    let before_memory = snapshot_value(state);
    let before_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    block_store_persistence(state, directory, blocked_name);

    let error = match operation(state) {
        Ok(_) => panic!("operation unexpectedly succeeded"),
        Err(error) => error,
    };
    assert!(!error.is_empty());

    let after_memory = snapshot_value(state);
    let after_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    assert_eq!(after_memory, before_memory);
    assert_eq!(after_disk, before_disk);
}

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

#[test]
fn snapshot_counts_context_reports_current_collection_sizes() {
    let snapshot = StoreSnapshot::seeded();
    let context = snapshot_counts_context(&snapshot);

    assert_eq!(context.get("draft_count"), Some(&json!(1)));
    assert_eq!(context.get("variable_preset_count"), Some(&json!(0)));
    assert_eq!(context.get("template_count"), Some(&json!(1)));
    assert_eq!(context.get("signature_count"), Some(&json!(1)));
    assert_eq!(context.get("memo_count"), Some(&json!(0)));
    assert_eq!(context.get("trash_count"), Some(&json!(0)));
}

#[test]
fn proofreading_settings_context_reports_disabled_rule_count() {
    let context = proofreading_settings_context(&ProofreadingSettings {
        disabled_rule_ids: vec!["prh".to_string(), "whitespace.trailing".to_string()],
    });

    assert_eq!(context.get("disabled_rule_count"), Some(&json!(2)));
}

#[test]
fn input_context_builders_capture_safe_lengths_and_flags() {
    let draft = DraftInput {
        id: "draft-1".to_string(),
        title: "Hello".to_string(),
        is_pinned: true,
        subject: "Sub".to_string(),
        recipient: "To".to_string(),
        opening: "Open".to_string(),
        body: "Body".to_string(),
        closing: "Bye".to_string(),
        template_id: Some("template-1".to_string()),
        signature_id: None,
        variable_values: BTreeMap::from([
            ("company".to_string(), "ACME".to_string()),
            ("person".to_string(), "Yamada".to_string()),
        ]),
    };
    let template = TemplateInput {
        id: "template-1".to_string(),
        name: "Thanks".to_string(),
        is_pinned: false,
        subject: "Follow up".to_string(),
        recipient: "Customer".to_string(),
        opening: "Hello".to_string(),
        body: "Body".to_string(),
        closing: "Regards".to_string(),
        signature_id: Some("signature-1".to_string()),
    };
    let preset = VariablePresetInput {
        id: "preset-1".to_string(),
        name: "A".to_string(),
        values: BTreeMap::from([("company".to_string(), "ACME".to_string())]),
    };
    let signature = SignatureInput {
        id: "signature-1".to_string(),
        name: "Std".to_string(),
        is_pinned: true,
        body: "Team".to_string(),
        is_default: false,
    };
    let memo = MemoInput {
        id: "memo-1".to_string(),
        title: "商談".to_string(),
        is_pinned: false,
        body: "要点".to_string(),
    };
    let logging = LoggingSettings {
        mode: LoggingMode::Off,
        retention_days: 30,
    };

    let draft_values = draft_context(&draft);
    assert_eq!(draft_values.get("has_template"), Some(&json!(true)));
    assert_eq!(draft_values.get("has_signature"), Some(&json!(false)));
    assert_eq!(draft_values.get("title_length"), Some(&json!(5)));
    assert_eq!(draft_values.get("is_pinned"), Some(&json!(true)));
    assert_eq!(draft_values.get("variable_count"), Some(&json!(2)));

    let template_values = template_context(&template);
    assert_eq!(template_values.get("has_signature"), Some(&json!(true)));
    assert_eq!(template_values.get("name_length"), Some(&json!(6)));
    assert_eq!(template_values.get("subject_length"), Some(&json!(9)));

    let preset_values = variable_preset_context(&preset);
    assert_eq!(preset_values.get("name_length"), Some(&json!(1)));
    assert_eq!(preset_values.get("value_count"), Some(&json!(1)));

    let signature_values = super::context::signature_context(&signature);
    assert_eq!(signature_values.get("name_length"), Some(&json!(3)));
    assert_eq!(signature_values.get("body_length"), Some(&json!(4)));
    assert_eq!(signature_values.get("is_pinned"), Some(&json!(true)));
    assert_eq!(signature_values.get("is_default"), Some(&json!(false)));

    let memo_values = memo_context(&memo);
    assert_eq!(memo_values.get("has_title"), Some(&json!(true)));
    assert_eq!(memo_values.get("title_length"), Some(&json!(2)));
    assert_eq!(memo_values.get("body_length"), Some(&json!(2)));

    let logging_values = logging_settings_context(&logging);
    assert_eq!(logging_values.get("mode"), Some(&json!("off")));
    assert_eq!(logging_values.get("retention_days"), Some(&json!(30)));
}

#[test]
fn trash_kind_and_merge_context_preserve_expected_keys() {
    let merged = merge_context(
        serde_json::Map::from_iter([
            ("left_only".to_string(), json!(1)),
            ("shared".to_string(), json!("left")),
        ]),
        serde_json::Map::from_iter([
            ("shared".to_string(), json!("right")),
            ("kind".to_string(), json!("template")),
        ]),
    );

    assert_eq!(
        trash_kind_context("template").get("kind"),
        Some(&json!("template"))
    );
    assert_eq!(merged.get("left_only"), Some(&json!(1)));
    assert_eq!(merged.get("shared"), Some(&json!("right")));
    assert_eq!(merged.get("kind"), Some(&json!("template")));
}

#[test]
fn save_template_and_variable_preset_persist_store_updates() {
    let (state, _directory) = make_state();

    let saved_template = state
        .save_template(TemplateInput {
            id: "template-follow-up".to_string(),
            name: "確認メール".to_string(),
            is_pinned: true,
            subject: "ご確認のお願い".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "ご確認をお願いします。".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            signature_id: Some("signature-default".to_string()),
        })
        .expect("save template");
    assert_eq!(saved_template.template.id, "template-follow-up");

    let snapshot = state
        .save_variable_preset(VariablePresetInput {
            id: "preset-a".to_string(),
            name: "A社向け".to_string(),
            values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
        })
        .expect("save preset");
    assert_eq!(snapshot.variable_presets.len(), 1);

    let snapshot = state
        .delete_variable_preset("preset-a")
        .expect("delete preset");
    assert_eq!(snapshot.variable_presets.len(), 0);
    assert_eq!(
        state.delete_variable_preset("missing").unwrap_err(),
        "指定した変数値セットが見つかりませんでした。"
    );

    let persisted = read_store(&store_file_path(&state));
    assert!(persisted
        .templates
        .iter()
        .any(|template| template.id == "template-follow-up"));
    assert!(persisted.variable_presets.is_empty());
}

#[test]
fn save_memo_persists_store_updates() {
    let (state, _directory) = make_state();

    let saved_memo = state
        .save_memo(MemoInput {
            id: "memo-1".to_string(),
            title: "打ち合わせメモ".to_string(),
            is_pinned: true,
            body: "宿題を確認".to_string(),
        })
        .expect("save memo");

    assert_eq!(saved_memo.id, "memo-1");
    assert_eq!(saved_memo.title, "打ち合わせメモ");
    assert_eq!(saved_memo.is_pinned, true);
    assert_eq!(saved_memo.body, "宿題を確認");

    let persisted = read_store(&store_file_path(&state));
    assert_eq!(persisted.memos[0].title, "打ち合わせメモ");
    assert_eq!(persisted.memos[0].is_pinned, true);
    assert_eq!(persisted.memos[0].body, "宿題を確認");
}

#[test]
fn trash_operations_round_trip_and_persist_snapshot_changes() {
    let (state, _directory) = make_state();

    let deleted = state
        .delete_template("template-thanks")
        .expect("trash template");
    assert_eq!(deleted.trashed_template.template.id, "template-thanks");

    let restored = state
        .restore_template_from_trash("template-thanks")
        .expect("restore template");
    assert_eq!(restored.template.id, "template-thanks");

    state
        .delete_template("template-thanks")
        .expect("trash template again");
    let removed_template = state
        .permanently_delete_template_from_trash("template-thanks")
        .expect("delete template permanently");
    assert!(removed_template.trash.templates.is_empty());
    assert_eq!(
        removed_template
            .drafts
            .as_ref()
            .and_then(|drafts| drafts.first())
            .and_then(|draft| draft.template_id.as_deref()),
        None
    );

    let deleted = state
        .delete_signature("signature-default")
        .expect("trash signature");
    assert!(deleted.signatures.is_empty());
    assert_eq!(deleted.trashed_signature.signature.id, "signature-default");

    let deleted = state
        .permanently_delete_signature_from_trash("signature-default")
        .expect("delete signature permanently");
    assert!(deleted.trash.signatures.is_empty());
    assert_eq!(
        deleted
            .drafts
            .as_ref()
            .and_then(|drafts| drafts.first())
            .and_then(|draft| draft.signature_id.as_deref()),
        None
    );
    assert_eq!(
        deleted
            .templates
            .as_ref()
            .and_then(|templates| templates.first())
            .and_then(|template| template.signature_id.as_deref()),
        None
    );
    assert_eq!(
        state.restore_signature_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );

    state
        .save_memo(MemoInput {
            id: "memo-trash".to_string(),
            title: "会議".to_string(),
            is_pinned: false,
            body: "確認事項".to_string(),
        })
        .expect("save memo");
    let deleted = state.delete_memo("memo-trash").expect("trash memo");
    assert_eq!(deleted.trashed_memo.memo.id, "memo-trash");

    let restored = state
        .restore_memo_from_trash("memo-trash")
        .expect("restore memo");
    assert_eq!(restored.id, "memo-trash");

    state.delete_memo("memo-trash").expect("trash memo again");
    let deleted = state
        .permanently_delete_memo_from_trash("memo-trash")
        .expect("delete memo permanently");
    assert!(deleted.trash.memos.is_empty());

    state.delete_draft("draft-welcome").expect("trash draft");
    let emptied = state.empty_trash().expect("empty trash");
    assert!(emptied.trash.drafts.is_empty());
    assert!(emptied.trash.templates.is_empty());
    assert!(emptied.trash.signatures.is_empty());
    assert!(emptied.trash.memos.is_empty());

    let persisted = read_store(&store_file_path(&state));
    assert!(persisted.trash.drafts.is_empty());
    assert!(persisted.trash.templates.is_empty());
    assert!(persisted.trash.signatures.is_empty());
    assert!(persisted.trash.memos.is_empty());
}

#[test]
fn restoring_trashed_draft_returns_cleaned_references_after_related_items_were_purged() {
    let (state, _directory) = make_state();

    state.delete_draft("draft-welcome").expect("trash draft");
    state
        .delete_template("template-thanks")
        .expect("trash template");
    state
        .delete_signature("signature-default")
        .expect("trash signature");
    state
        .permanently_delete_template_from_trash("template-thanks")
        .expect("purge template");
    state
        .permanently_delete_signature_from_trash("signature-default")
        .expect("purge signature");

    let restored = state
        .restore_draft_from_trash("draft-welcome")
        .expect("restore draft");

    assert_eq!(restored.draft.template_id, None);
    assert_eq!(restored.draft.signature_id, None);
    assert_eq!(
        restored
            .draft_history
            .iter()
            .all(|entry| entry.template_id.is_none() && entry.signature_id.is_none()),
        true
    );

    let persisted = read_store(&store_file_path(&state));
    assert_eq!(persisted.drafts[0].template_id, None);
    assert_eq!(persisted.drafts[0].signature_id, None);
    assert_eq!(
        persisted
            .draft_history
            .iter()
            .all(|entry| entry.template_id.is_none() && entry.signature_id.is_none()),
        true
    );
}

#[test]
fn restoring_trashed_template_returns_a_cleaned_signature_reference() {
    let (state, _directory) = make_state();

    state
        .delete_template("template-thanks")
        .expect("trash template");
    state
        .delete_signature("signature-default")
        .expect("trash signature");
    state
        .permanently_delete_signature_from_trash("signature-default")
        .expect("purge signature");

    let restored = state
        .restore_template_from_trash("template-thanks")
        .expect("restore template");

    assert_eq!(restored.template.signature_id, None);

    let persisted = read_store(&store_file_path(&state));
    assert_eq!(persisted.templates[0].signature_id, None);
}

#[test]
fn logging_settings_and_backup_methods_round_trip_state() {
    let (state, directory) = make_state();

    state
        .save_template(TemplateInput {
            id: "template-exported".to_string(),
            name: "書き出し用".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "".to_string(),
            opening: "冒頭".to_string(),
            body: "本文".to_string(),
            closing: "末尾".to_string(),
            signature_id: Some("signature-default".to_string()),
        })
        .expect("save template");

    let settings_snapshot = state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .expect("save logging settings");
    assert_eq!(settings_snapshot.mode, LoggingMode::Standard);
    assert_eq!(settings_snapshot.retention_days, 30);
    let proofreading_snapshot = state
        .save_proofreading_settings(ProofreadingSettingsInput {
            disabled_rule_ids: vec![" prh ".to_string(), "whitespace.trailing".to_string()],
        })
        .expect("save proofreading settings");
    assert_eq!(
        proofreading_snapshot.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let persisted_settings = read_settings_file(&settings_file_path(&state));
    assert_eq!(persisted_settings.logging.mode, LoggingMode::Standard);
    assert_eq!(persisted_settings.logging.retention_days, 30);
    assert_eq!(
        persisted_settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    state.log_event_with_settings(
        &LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        LogEntry {
            level: LogLevel::Info,
            event_name: "tests.logging",
            module: "tests",
            result: "success",
            duration_ms: Some(5),
            error_code: None,
            safe_context: serde_json::Map::new(),
        },
    );

    let recent_logs = state.load_recent_logs(Some(5)).expect("recent logs");
    assert!(!recent_logs.is_empty());

    let cleared = state.clear_logs().expect("clear logs");
    assert_eq!(cleared.file_count, 0);

    let backup_path = directory.path().join("maildraft-backup.json");
    let exported_path = state
        .export_backup(backup_path.to_str().expect("backup path"))
        .expect("export backup");
    assert_eq!(exported_path, backup_path.display().to_string());

    let (import_state, _other_directory) = make_state();
    let imported = import_state
        .import_backup(backup_path.to_str().expect("backup path"))
        .expect("import backup");
    assert_eq!(imported.snapshot.templates.len(), 2);
    assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
    assert_eq!(imported.logging_settings.retention_days, 30);
    assert_eq!(
        imported.proofreading_settings.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn runtime_backup_methods_round_trip_with_sqlite_repository() {
    let (state, directory) = make_runtime_state();

    state
        .save_template(TemplateInput {
            id: "template-runtime-exported".to_string(),
            name: "SQLite 書き出し".to_string(),
            is_pinned: true,
            subject: "件名".to_string(),
            recipient: "宛先".to_string(),
            opening: "冒頭".to_string(),
            body: "本文".to_string(),
            closing: "末尾".to_string(),
            signature_id: Some("signature-default".to_string()),
        })
        .expect("save template");
    state
        .save_memo(MemoInput {
            id: "memo-runtime-exported".to_string(),
            title: "SQLite メモ".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        })
        .expect("save memo");
    state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .expect("save logging settings");
    state
        .save_proofreading_settings(ProofreadingSettingsInput {
            disabled_rule_ids: vec![" prh ".to_string(), "whitespace.trailing".to_string()],
        })
        .expect("save proofreading settings");

    let backup_path = directory.path().join("runtime-backup.json");
    state
        .export_backup(backup_path.to_str().expect("backup path"))
        .expect("export backup");

    let document = decode_backup_document(&fs::read_to_string(&backup_path).expect("read backup"))
        .expect("decode backup");
    assert!(document
        .snapshot
        .templates
        .iter()
        .any(|template| template.id == "template-runtime-exported"));
    assert!(document
        .snapshot
        .memos
        .iter()
        .any(|memo| memo.id == "memo-runtime-exported"));
    assert_eq!(document.settings.logging.mode, LoggingMode::Standard);
    assert_eq!(document.settings.logging.retention_days, 30);
    assert_eq!(
        document.settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let (import_state, import_directory) = make_runtime_state();
    let imported = import_state
        .import_backup(backup_path.to_str().expect("backup path"))
        .expect("import backup");
    let import_db_path = runtime_database_path(import_directory.path());

    assert!(imported
        .snapshot
        .templates
        .iter()
        .any(|template| template.id == "template-runtime-exported"));
    assert!(imported
        .snapshot
        .memos
        .iter()
        .any(|memo| memo.id == "memo-runtime-exported"));
    assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
    assert_eq!(imported.logging_settings.retention_days, 30);
    assert_eq!(
        imported.proofreading_settings.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let persisted_store = read_sqlite_store(&import_db_path);
    let persisted_settings = read_sqlite_settings(&import_db_path);
    assert!(persisted_store
        .templates
        .iter()
        .any(|template| template.id == "template-runtime-exported"));
    assert!(persisted_store
        .memos
        .iter()
        .any(|memo| memo.id == "memo-runtime-exported"));
    assert_eq!(persisted_settings.logging.mode, LoggingMode::Standard);
    assert_eq!(persisted_settings.logging.retention_days, 30);
    assert_eq!(
        persisted_settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn runtime_export_backup_reads_persisted_sqlite_state_instead_of_unsaved_memory() {
    let (state, directory) = make_runtime_state();
    let db_path = runtime_database_path(directory.path());
    let export_path = directory.path().join("runtime-persisted-export.json");
    let persisted_store = read_sqlite_store(&db_path);
    let persisted_settings = read_sqlite_settings(&db_path);

    {
        let mut store = state.store.lock().expect("store lock");
        store.drafts[0].title = "unsaved runtime title".to_string();
        store.signatures[0].is_default = false;
    }
    {
        let mut settings = state.settings.lock().expect("settings lock");
        settings.logging.retention_days = 30;
        settings.proofreading.disabled_rule_ids = vec!["prh".to_string()];
    }

    state
        .export_backup(export_path.to_str().expect("export path"))
        .expect("export backup");

    let document = decode_backup_document(&fs::read_to_string(&export_path).expect("read backup"))
        .expect("decode backup");

    assert_eq!(
        serde_json::to_value(document.snapshot).expect("serialize document snapshot"),
        serde_json::to_value(persisted_store).expect("serialize persisted snapshot"),
    );
    assert_eq!(
        serde_json::to_value(document.settings).expect("serialize document settings"),
        serde_json::to_value(persisted_settings).expect("serialize persisted settings"),
    );
}

#[test]
fn import_backup_normalizes_snapshot_and_logging_settings_before_persisting() {
    let (state, directory) = make_state();
    let backup_path = directory.path().join("maildraft-normalized-backup.json");
    let mut snapshot = StoreSnapshot::seeded();
    snapshot.drafts[0].template_id = Some("missing-template".to_string());
    snapshot.drafts[0].signature_id = Some("missing-signature".to_string());
    snapshot.templates[0].signature_id = Some("missing-signature".to_string());
    snapshot.signatures[0].is_default = false;
    snapshot.memos = vec![
        Memo {
            id: "memo-1".to_string(),
            title: "older".to_string(),
            is_pinned: false,
            body: "older body".to_string(),
            created_at: "0".to_string(),
            updated_at: "10".to_string(),
        },
        Memo {
            id: "memo-1".to_string(),
            title: "newer".to_string(),
            is_pinned: false,
            body: "newer body".to_string(),
            created_at: "0".to_string(),
            updated_at: "20".to_string(),
        },
    ];

    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 99,
                },
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec![" whitespace.trailing ".to_string(), "prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");

    let imported = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .expect("import backup");

    assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
    assert_eq!(imported.logging_settings.retention_days, 14);
    assert_eq!(
        imported.proofreading_settings.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
    assert_eq!(imported.snapshot.drafts[0].template_id, None);
    assert_eq!(imported.snapshot.drafts[0].signature_id, None);
    assert_eq!(imported.snapshot.templates[0].signature_id, None);
    assert_eq!(
        imported
            .snapshot
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(
        imported
            .snapshot
            .memos
            .iter()
            .map(|memo| memo.title.as_str())
            .collect::<Vec<_>>(),
        vec!["newer", "older"]
    );
    assert_eq!(
        imported
            .snapshot
            .memos
            .iter()
            .all(|memo| !memo.id.trim().is_empty()),
        true
    );
    assert_eq!(
        imported
            .snapshot
            .memos
            .iter()
            .map(|memo| memo.id.as_str())
            .collect::<std::collections::HashSet<_>>()
            .len(),
        2
    );

    let persisted_store = read_store(&store_file_path(&state));
    let persisted_settings = read_settings_file(&settings_file_path(&state));
    assert_eq!(persisted_store.drafts[0].template_id, None);
    assert_eq!(persisted_store.drafts[0].signature_id, None);
    assert_eq!(persisted_store.templates[0].signature_id, None);
    assert_eq!(persisted_settings.logging.retention_days, 14);
    assert_eq!(
        persisted_settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn export_backup_reads_persisted_state_instead_of_unsaved_memory() {
    let (state, directory) = make_state();
    let export_path = directory.path().join("normalized-export.json");
    let persisted_store = read_store(&store_file_path(&state));
    let persisted_settings = read_settings_file(&settings_file_path(&state));

    {
        let mut store = state.store.lock().expect("store lock");
        store.drafts[0].title = "unsaved json title".to_string();
        store.signatures[0].is_default = false;
    }
    {
        let mut settings = state.settings.lock().expect("settings lock");
        settings.logging.retention_days = 30;
        settings.proofreading.disabled_rule_ids = vec![" prh ".to_string()];
    }

    state
        .export_backup(export_path.to_str().expect("export path"))
        .expect("export backup");

    let document = decode_backup_document(&fs::read_to_string(&export_path).expect("read backup"))
        .expect("decode backup");

    assert_eq!(
        serde_json::to_value(document.snapshot).expect("serialize document snapshot"),
        serde_json::to_value(persisted_store).expect("serialize persisted snapshot"),
    );
    assert_eq!(
        serde_json::to_value(document.settings).expect("serialize document settings"),
        serde_json::to_value(persisted_settings).expect("serialize persisted settings"),
    );
}

#[test]
fn failed_import_does_not_mutate_existing_store_or_settings() {
    let (state, directory) = make_state();

    state
        .save_memo(MemoInput {
            id: "memo-existing".to_string(),
            title: "既存メモ".to_string(),
            is_pinned: true,
            body: "既存本文".to_string(),
        })
        .expect("save memo");
    state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .expect("save logging settings");

    let before_store =
        serde_json::to_value(read_store(&store_file_path(&state))).expect("serialize store");
    let before_settings = serde_json::to_value(read_settings_file(&settings_file_path(&state)))
        .expect("serialize settings");
    let invalid_backup = directory.path().join("invalid-import.json");
    fs::write(&invalid_backup, "{\"version\":999}").expect("write invalid backup");

    assert_eq!(
        state
            .import_backup(invalid_backup.to_str().expect("invalid path"))
            .unwrap_err(),
        "このバックアップ形式には対応していません。"
    );

    let after_store =
        serde_json::to_value(read_store(&store_file_path(&state))).expect("serialize store");
    let after_settings = serde_json::to_value(read_settings_file(&settings_file_path(&state)))
        .expect("serialize settings");
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
}

#[test]
fn save_draft_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-store-path",
        |state| {
            state.save_draft(DraftInput {
                id: "draft-welcome".to_string(),
                title: "壊してはいけない下書き".to_string(),
                is_pinned: true,
                subject: "失敗した保存".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "この更新はロールバックされるべきです。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                template_id: Some("template-thanks".to_string()),
                signature_id: Some("signature-default".to_string()),
                variable_values: BTreeMap::new(),
            })
        },
    );
}

#[test]
fn save_template_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-template-store-path",
        |state| {
            state.save_template(TemplateInput {
                id: "template-thanks".to_string(),
                name: "壊してはいけないテンプレート".to_string(),
                is_pinned: true,
                subject: "変更されるべきではない".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "ロールバックされる本文".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                signature_id: Some("signature-default".to_string()),
            })
        },
    );
}

#[test]
fn save_signature_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-signature-store-path",
        |state| {
            state.save_signature(SignatureInput {
                id: "signature-default".to_string(),
                name: "壊してはいけない署名".to_string(),
                is_pinned: true,
                body: "ロールバック対象".to_string(),
                is_default: false,
            })
        },
    );
}

#[test]
fn save_memo_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-memo-store-path",
        |state| {
            state.save_memo(MemoInput {
                id: "memo-rollback".to_string(),
                title: "新規メモ".to_string(),
                is_pinned: true,
                body: "保存失敗で残ってはいけない".to_string(),
            })
        },
    );
}

#[test]
fn save_variable_preset_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-preset-store-path",
        |state| {
            state.save_variable_preset(VariablePresetInput {
                id: "preset-rollback".to_string(),
                name: "新規セット".to_string(),
                values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
            })
        },
    );
}

#[test]
fn delete_template_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-delete-template-path",
        |state| state.delete_template("template-thanks"),
    );
}

#[test]
fn delete_memo_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .save_memo(MemoInput {
            id: "memo-delete".to_string(),
            title: "削除対象".to_string(),
            is_pinned: false,
            body: "削除失敗で残るべき".to_string(),
        })
        .expect("save memo");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-delete-memo-path",
        |state| state.delete_memo("memo-delete"),
    );
}

#[test]
fn restore_draft_history_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .save_draft(DraftInput {
            id: "draft-welcome".to_string(),
            title: "履歴作成".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "変更後の本文".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        })
        .expect("save draft");
    let history_id = state
        .load_snapshot()
        .expect("snapshot")
        .draft_history
        .first()
        .expect("history")
        .id
        .clone();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-restore-history-path",
        |state| state.restore_draft_history("draft-welcome", &history_id),
    );
}

#[test]
fn restore_signature_from_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .delete_signature("signature-default")
        .expect("trash signature");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-restore-signature-path",
        |state| state.restore_signature_from_trash("signature-default"),
    );
}

#[test]
fn restore_memo_from_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .save_memo(MemoInput {
            id: "memo-restore".to_string(),
            title: "復元対象".to_string(),
            is_pinned: false,
            body: "復元失敗で残るべき".to_string(),
        })
        .expect("save memo");
    state.delete_memo("memo-restore").expect("trash memo");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-restore-memo-path",
        |state| state.restore_memo_from_trash("memo-restore"),
    );
}

#[test]
fn permanently_delete_signature_from_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .delete_signature("signature-default")
        .expect("trash signature");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-purge-signature-path",
        |state| state.permanently_delete_signature_from_trash("signature-default"),
    );
}

#[test]
fn empty_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    let original_store_path = store_file_path(&state);

    state.delete_draft("draft-welcome").expect("trash draft");
    state
        .delete_template("template-thanks")
        .expect("trash template");

    let before_memory = serde_json::to_value(
        state
            .load_snapshot()
            .expect("snapshot before empty failure"),
    )
    .expect("serialize before");
    let before_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    let blocked_store_path = directory.path().join("blocked-empty-trash-path");
    fs::create_dir_all(&blocked_store_path).expect("create blocked store path");
    let settings_path = settings_file_path(&state);
    state.replace_json_repository_for_tests(blocked_store_path, settings_path);

    let error = state.empty_trash().unwrap_err();
    assert!(!error.is_empty());

    let after_memory =
        serde_json::to_value(state.load_snapshot().expect("snapshot after empty failure"))
            .expect("serialize after");
    let after_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    assert_eq!(after_memory, before_memory);
    assert_eq!(after_disk, before_disk);
}

#[test]
fn save_logging_settings_rolls_back_when_settings_persistence_fails() {
    let (mut state, directory) = make_state();
    let original_settings_path = settings_file_path(&state);
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");
    block_settings_persistence(&mut state, directory.path(), "blocked-settings-path");

    let error = state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .unwrap_err();
    assert!(!error.is_empty());

    let current_logging = state
        .load_logging_settings()
        .expect("logging settings after failure");
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    assert_eq!(current_logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(current_logging.retention_days, 14);
    assert_eq!(after_settings, before_settings);
}

#[test]
fn save_logging_settings_rolls_back_when_log_pruning_fails() {
    let (state, directory) = make_state();
    let state = state;
    let original_settings_path = settings_file_path(&state);
    let before_memory = settings_value(&state);
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");
    replace_logs_directory_with_file(directory.path());

    let error = state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = settings_value(&state);
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    assert_eq!(after_memory, before_memory);
    assert_eq!(after_settings, before_settings);
}

#[test]
fn import_backup_rolls_back_store_and_settings_when_settings_persistence_fails() {
    let (mut state, directory) = make_state();
    let original_store_path = store_file_path(&state);
    let original_settings_path = settings_file_path(&state);
    let before_memory = serde_json::to_value(
        state
            .load_snapshot()
            .expect("snapshot before import failure"),
    )
    .expect("serialize before");
    let before_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store before");
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");

    let mut imported_snapshot = StoreSnapshot::seeded();
    imported_snapshot.memos.push(Memo {
        id: "memo-imported".to_string(),
        title: "復元メモ".to_string(),
        is_pinned: true,
        body: "この内容は失敗時に残ってはいけません。".to_string(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    });
    let backup_path = directory.path().join("rollback-import.json");
    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            imported_snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec!["prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");

    let blocked_settings_path = directory.path().join("blocked-import-settings-path");
    fs::create_dir_all(&blocked_settings_path).expect("create blocked settings path");
    let store_path = store_file_path(&state);
    state.replace_json_repository_for_tests(store_path, blocked_settings_path);

    let error = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = serde_json::to_value(
        state
            .load_snapshot()
            .expect("snapshot after import failure"),
    )
    .expect("serialize after");
    let after_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store after");
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    let current_logging = state
        .load_logging_settings()
        .expect("logging settings after failure");

    assert_eq!(after_memory, before_memory);
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
    assert_eq!(current_logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(current_logging.retention_days, 14);
}

#[test]
fn import_backup_rolls_back_store_and_settings_when_log_pruning_fails() {
    let (state, directory) = make_state();
    let state = state;
    let original_store_path = store_file_path(&state);
    let original_settings_path = settings_file_path(&state);
    let before_memory = snapshot_value(&state);
    let before_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store before");
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");

    let mut imported_snapshot = StoreSnapshot::seeded();
    imported_snapshot.memos.push(Memo {
        id: "memo-imported-log".to_string(),
        title: "復元メモ".to_string(),
        is_pinned: true,
        body: "この内容は log prune failure で残ってはいけません。".to_string(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    });
    let backup_path = directory.path().join("rollback-import-log.json");
    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            imported_snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec!["prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");
    replace_logs_directory_with_file(directory.path());

    let error = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = snapshot_value(&state);
    let after_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store after");
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    let after_memory_settings = settings_value(&state);

    assert_eq!(after_memory, before_memory);
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
    assert_eq!(after_memory_settings, before_settings);
}

#[test]
fn runtime_import_backup_rolls_back_sqlite_state_when_log_pruning_fails() {
    let (state, directory) = make_runtime_state();
    let db_path = runtime_database_path(directory.path());
    let before_memory = snapshot_value(&state);
    let before_memory_settings = settings_value(&state);
    let before_store =
        serde_json::to_value(read_sqlite_store(&db_path)).expect("serialize store before");
    let before_settings =
        serde_json::to_value(read_sqlite_settings(&db_path)).expect("serialize settings before");

    let mut imported_snapshot = StoreSnapshot::seeded();
    imported_snapshot.memos.push(Memo {
        id: "memo-runtime-imported-log".to_string(),
        title: "復元メモ".to_string(),
        is_pinned: true,
        body: "この内容は log prune failure で残ってはいけません。".to_string(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    });
    let backup_path = directory.path().join("runtime-rollback-import-log.json");
    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            imported_snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec!["prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");
    replace_logs_directory_with_file(directory.path());

    let error = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = snapshot_value(&state);
    let after_memory_settings = settings_value(&state);
    let after_store =
        serde_json::to_value(read_sqlite_store(&db_path)).expect("serialize store after");
    let after_settings =
        serde_json::to_value(read_sqlite_settings(&db_path)).expect("serialize settings after");

    assert_eq!(after_memory, before_memory);
    assert_eq!(after_memory_settings, before_memory_settings);
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
}

#[test]
fn load_recent_logs_and_clear_logs_report_corrupted_log_storage() {
    let (state, directory) = make_state();
    let before_settings = settings_value(&state);
    replace_logs_directory_with_file(directory.path());

    assert!(!state.load_logging_settings().unwrap_err().is_empty());
    assert!(!state.load_recent_logs(Some(10)).unwrap_err().is_empty());
    assert!(!state.clear_logs().unwrap_err().is_empty());
    assert_eq!(settings_value(&state), before_settings);
}

#[test]
fn missing_items_return_stable_errors_and_recent_logs_respect_limits() {
    let (state, _directory) = make_state();

    assert_eq!(
        state.delete_draft("missing").unwrap_err(),
        "指定した下書きが見つかりませんでした。"
    );
    assert_eq!(
        state
            .restore_draft_history("draft-welcome", "missing")
            .unwrap_err(),
        "指定した履歴が見つかりませんでした。"
    );
    assert_eq!(
        state.delete_template("missing").unwrap_err(),
        "指定したテンプレートが見つかりませんでした。"
    );
    assert_eq!(
        state.delete_signature("missing").unwrap_err(),
        "指定した署名が見つかりませんでした。"
    );
    assert_eq!(
        state.delete_memo("missing").unwrap_err(),
        "指定したメモが見つかりませんでした。"
    );
    assert_eq!(
        state.restore_draft_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state.restore_template_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state.restore_signature_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state.restore_memo_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_draft_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_template_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_signature_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_memo_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );

    let logging_settings = LoggingSettings {
        mode: LoggingMode::Standard,
        retention_days: 30,
    };
    for index in 0..205 {
        state.log_event_with_settings(
            &logging_settings,
            LogEntry {
                level: LogLevel::Info,
                event_name: "tests.limit",
                module: "tests",
                result: "success",
                duration_ms: Some(index),
                error_code: None,
                safe_context: serde_json::Map::from_iter([("index".to_string(), json!(index))]),
            },
        );
    }

    assert_eq!(state.load_recent_logs(Some(0)).unwrap().len(), 1);
    assert_eq!(state.load_recent_logs(None).unwrap().len(), 80);
    assert_eq!(state.load_recent_logs(Some(999)).unwrap().len(), 200);
}

#[test]
fn backup_methods_propagate_export_and_import_failures() {
    let (state, directory) = make_state();

    let export_error = state
        .export_backup(directory.path().to_str().expect("directory path"))
        .unwrap_err();
    assert!(!export_error.is_empty());

    let invalid_backup = directory.path().join("invalid-backup.json");
    fs::write(
        &invalid_backup,
        serde_json::to_string(&json!({
            "app": "maildraft",
            "snapshot": {}
        }))
        .expect("serialize invalid backup"),
    )
    .expect("write invalid backup");

    assert_eq!(
        state
            .import_backup(invalid_backup.to_str().expect("invalid backup path"))
            .unwrap_err(),
        "このバックアップ形式には対応していません。"
    );
}

#[test]
fn backup_methods_validate_path_shape_and_size_limits() {
    let (state, directory) = make_state();

    assert_eq!(
        state.export_backup("relative-backup.json").unwrap_err(),
        "バックアップの書き出し先は絶対パスの .json ファイルを指定してください。"
    );

    let invalid_extension = directory.path().join("backup.txt");
    assert_eq!(
        state
            .export_backup(invalid_extension.to_str().expect("invalid extension path"))
            .unwrap_err(),
        "バックアップの書き出し先は絶対パスの .json ファイルを指定してください。"
    );

    let oversized_backup = directory.path().join("oversized-backup.json");
    let oversized_file = std::fs::File::create(&oversized_backup).expect("create oversized file");
    oversized_file
        .set_len(MAX_BACKUP_FILE_BYTES + 1)
        .expect("set oversized len");
    assert_eq!(
        state
            .import_backup(oversized_backup.to_str().expect("oversized backup path"))
            .unwrap_err(),
        "バックアップファイルが大きすぎます。"
    );
}

#[test]
fn save_operations_reject_invalid_input_and_preserve_state() {
    let (state, _directory) = make_state();
    let before = snapshot_value(&state);

    assert_eq!(
        state
            .save_draft(DraftInput {
                id: " ".to_string(),
                title: "invalid".to_string(),
                is_pinned: false,
                subject: String::new(),
                recipient: String::new(),
                opening: String::new(),
                body: String::new(),
                closing: String::new(),
                template_id: None,
                signature_id: None,
                variable_values: BTreeMap::new(),
            })
            .unwrap_err(),
        "下書きIDは空にできません。"
    );

    assert_eq!(
        state
            .save_template(TemplateInput {
                id: "template-invalid".to_string(),
                name: "invalid".to_string(),
                is_pinned: false,
                subject: String::new(),
                recipient: String::new(),
                opening: String::new(),
                body: String::new(),
                closing: String::new(),
                signature_id: Some("missing-signature".to_string()),
            })
            .unwrap_err(),
        "選択した署名が見つかりませんでした。"
    );

    assert_eq!(
        state
            .save_proofreading_settings(ProofreadingSettingsInput {
                disabled_rule_ids: vec!["rule".to_string(); 101],
            })
            .unwrap_err(),
        "無効化する校正ルール数が上限を超えています。"
    );

    assert_eq!(snapshot_value(&state), before);
}

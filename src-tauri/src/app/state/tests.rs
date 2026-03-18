use std::{collections::BTreeMap, fs, path::Path};

use pretty_assertions::assert_eq;
use serde_json::json;
use tempfile::tempdir;

use super::{
    context::{
        draft_context, logging_settings_context, merge_context, snapshot_counts_context,
        template_context, trash_kind_context, variable_preset_context,
    },
    AppState,
};
use crate::{
    app::{
        logging::{LogEntry, LogLevel},
        settings::{AppSettings, LoggingMode, LoggingSettings, LoggingSettingsInput},
        storage::{load_app_settings, load_store_snapshot, StartupNoticeTone},
    },
    modules::{
        drafts::DraftInput, signatures::SignatureInput, store::StoreSnapshot,
        templates::TemplateInput, variable_presets::VariablePresetInput,
    },
};

fn make_state() -> (AppState, tempfile::TempDir) {
    let directory = tempdir().expect("tempdir");
    let state = AppState::new_for_tests(directory.path()).expect("state");
    (state, directory)
}

fn read_store(path: &Path) -> StoreSnapshot {
    load_store_snapshot(path).expect("store snapshot")
}

fn read_settings_file(path: &Path) -> AppSettings {
    load_app_settings(path).expect("settings file")
}

fn backup_path(path: &Path) -> std::path::PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .expect("backup file name");
    path.with_file_name(format!("{}.bak", file_name))
}

#[test]
fn load_settings_defaults_missing_files_and_normalizes_saved_values() {
    let directory = tempdir().expect("tempdir");
    let missing_path = directory.path().join("missing.json");

    let default_settings = load_app_settings(&missing_path).expect("default settings");
    assert_eq!(default_settings.logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(default_settings.logging.retention_days, 14);

    let saved_path = directory.path().join("settings.json");
    let content = serde_json::to_string(&AppSettings {
        logging: LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 99,
        },
    })
    .expect("serialize settings");
    fs::write(&saved_path, content).expect("write settings");

    let loaded = load_app_settings(&saved_path).expect("load settings");
    assert_eq!(loaded.logging.mode, LoggingMode::Standard);
    assert_eq!(loaded.logging.retention_days, 14);
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
fn snapshot_counts_context_reports_current_collection_sizes() {
    let snapshot = StoreSnapshot::seeded();
    let context = snapshot_counts_context(&snapshot);

    assert_eq!(context.get("draft_count"), Some(&json!(1)));
    assert_eq!(context.get("variable_preset_count"), Some(&json!(0)));
    assert_eq!(context.get("template_count"), Some(&json!(1)));
    assert_eq!(context.get("signature_count"), Some(&json!(1)));
    assert_eq!(context.get("trash_count"), Some(&json!(0)));
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

    let persisted = read_store(&state.store_path);
    assert!(persisted
        .templates
        .iter()
        .any(|template| template.id == "template-follow-up"));
    assert!(persisted.variable_presets.is_empty());
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
        state.restore_signature_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );

    state.delete_draft("draft-welcome").expect("trash draft");
    let emptied = state.empty_trash().expect("empty trash");
    assert!(emptied.trash.drafts.is_empty());
    assert!(emptied.trash.templates.is_empty());
    assert!(emptied.trash.signatures.is_empty());

    let persisted = read_store(&state.store_path);
    assert!(persisted.trash.drafts.is_empty());
    assert!(persisted.trash.templates.is_empty());
    assert!(persisted.trash.signatures.is_empty());
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

    let persisted_settings = read_settings_file(&state.settings_path);
    assert_eq!(persisted_settings.logging.mode, LoggingMode::Standard);
    assert_eq!(persisted_settings.logging.retention_days, 30);

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
}

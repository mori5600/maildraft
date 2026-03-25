use std::{collections::BTreeMap, fs};

use pretty_assertions::assert_eq;
use serde_json::json;
use tempfile::tempdir;

use super::{
    clear_logs, delete_draft, delete_memo, delete_signature, delete_template,
    delete_variable_preset, empty_trash, load_logging_settings, load_proofreading_settings,
    load_recent_logs, load_snapshot, load_startup_notice, permanently_delete_draft_from_trash,
    permanently_delete_memo_from_trash, permanently_delete_signature_from_trash,
    permanently_delete_template_from_trash, restore_draft_from_trash, restore_draft_history,
    restore_memo_from_trash, restore_signature_from_trash, restore_template_from_trash, save_draft,
    save_logging_settings, save_memo, save_proofreading_settings, save_signature, save_template,
    save_variable_preset,
};
use crate::app::settings::{LoggingMode, LoggingSettingsInput, ProofreadingSettingsInput};
use crate::app::state::AppState;
use crate::modules::{
    drafts::DraftInput, memo::MemoInput, signatures::SignatureInput, templates::TemplateInput,
    variable_presets::VariablePresetInput,
};

use super::common::{load_snapshot_impl, load_startup_notice_impl};
use super::drafts::{
    delete_draft_impl, permanently_delete_draft_from_trash_impl, restore_draft_from_trash_impl,
    restore_draft_history_impl, save_draft_impl,
};
use super::memo::{
    delete_memo_impl, permanently_delete_memo_from_trash_impl, restore_memo_from_trash_impl,
    save_memo_impl,
};
use super::settings::{
    backup_default_file_name_from_parts, clear_logs_impl, export_backup_impl, import_backup_impl,
    load_logging_settings_impl, load_proofreading_settings_impl, load_recent_logs_impl,
    save_logging_settings_impl, save_proofreading_settings_impl,
};
use super::signatures::{
    delete_signature_impl, permanently_delete_signature_from_trash_impl,
    restore_signature_from_trash_impl, save_signature_impl,
};
use super::templates::{
    delete_template_impl, permanently_delete_template_from_trash_impl,
    restore_template_from_trash_impl, save_template_impl,
};
use super::trash::empty_trash_impl;
use super::variable_presets::{delete_variable_preset_impl, save_variable_preset_impl};

fn make_state() -> (AppState, tempfile::TempDir) {
    let directory = tempdir().expect("tempdir");
    let state = AppState::new_for_tests(directory.path()).expect("state");
    (state, directory)
}

fn as_tauri_state(state: &AppState) -> tauri::State<'_, AppState> {
    // SAFETY: `tauri::State` is a newtype wrapper over `&T` and the command wrappers
    // only dereference it to forward into the tested `*_impl` functions.
    unsafe { std::mem::transmute::<&AppState, tauri::State<'_, AppState>>(state) }
}

#[test]
fn draft_commands_round_trip_snapshot_history_and_trash() {
    let (state, _directory) = make_state();
    let initial = load_snapshot_impl(&state).expect("load snapshot");
    assert_eq!(initial.drafts.len(), 1);
    assert_eq!(
        load_startup_notice_impl(&state).expect("load startup notice"),
        None
    );

    let saved = save_draft_impl(
        &state,
        DraftInput {
            id: "draft-command".to_string(),
            title: "確認依頼".to_string(),
            is_pinned: false,
            subject: "ご確認ください".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "内容をご確認ください。".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::from([("担当者名".to_string(), "山田様".to_string())]),
        },
    )
    .expect("save draft");
    assert_eq!(saved.draft.id, "draft-command");

    let trashed = delete_draft_impl(&state, "draft-command".to_string()).expect("trash draft");
    assert_eq!(trashed.trashed_draft.draft.id, "draft-command");

    let restored =
        restore_draft_from_trash_impl(&state, "draft-command".to_string()).expect("restore");
    assert_eq!(restored.draft.id, "draft-command");

    let updated = save_draft_impl(
        &state,
        DraftInput {
            id: "draft-command".to_string(),
            title: "確認依頼".to_string(),
            is_pinned: true,
            subject: "件名を更新しました".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "修正版です。".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
    )
    .expect("update draft");
    let history = updated
        .draft_history
        .iter()
        .find(|entry| entry.draft_id == "draft-command")
        .expect("history entry");

    let restored_history =
        restore_draft_history_impl(&state, "draft-command".to_string(), history.id.clone())
            .expect("restore history");
    let restored_draft = &restored_history.draft;
    assert_eq!(restored_draft.subject, "ご確認ください");
    assert!(restored_history
        .draft_history
        .iter()
        .any(|entry| entry.draft_id == "draft-command"));

    delete_draft_impl(&state, "draft-command".to_string()).expect("trash again");
    let permanently_deleted =
        permanently_delete_draft_from_trash_impl(&state, "draft-command".to_string())
            .expect("delete permanently");
    assert!(permanently_deleted
        .trash
        .drafts
        .iter()
        .all(|draft| draft.draft.id != "draft-command"));
}

#[test]
fn template_signature_and_variable_preset_commands_round_trip() {
    let (state, _directory) = make_state();

    let templates = save_template_impl(
        &state,
        TemplateInput {
            id: "template-command".to_string(),
            name: "督促".to_string(),
            is_pinned: true,
            subject: "ご確認のお願い".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "ご確認ください。".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            signature_id: Some("signature-default".to_string()),
        },
    )
    .expect("save template");
    assert_eq!(templates.template.id, "template-command");

    let presets = save_variable_preset_impl(
        &state,
        VariablePresetInput {
            id: "preset-command".to_string(),
            name: "A社".to_string(),
            values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
        },
    )
    .expect("save preset");
    assert_eq!(presets.variable_presets.len(), 1);

    let without_preset =
        delete_variable_preset_impl(&state, "preset-command".to_string()).expect("delete preset");
    assert!(without_preset.variable_presets.is_empty());

    let signatures = save_signature_impl(
        &state,
        SignatureInput {
            id: "signature-command".to_string(),
            name: "営業署名".to_string(),
            is_pinned: false,
            body: "株式会社△△\n山田 太郎".to_string(),
            is_default: false,
        },
    )
    .expect("save signature");
    assert!(signatures
        .signatures
        .iter()
        .any(|signature| signature.id == "signature-command"));

    delete_template_impl(&state, "template-command".to_string()).expect("trash template");
    let restored_template =
        restore_template_from_trash_impl(&state, "template-command".to_string())
            .expect("restore template");
    assert_eq!(restored_template.template.id, "template-command");

    delete_template_impl(&state, "template-command".to_string()).expect("trash template");
    let removed_template =
        permanently_delete_template_from_trash_impl(&state, "template-command".to_string())
            .expect("delete template permanently");
    assert!(removed_template
        .trash
        .templates
        .iter()
        .all(|template| template.template.id != "template-command"));
    assert!(removed_template.drafts.is_some());
    assert!(removed_template.draft_history.is_some());

    delete_signature_impl(&state, "signature-command".to_string()).expect("trash signature");
    let restored_signature =
        restore_signature_from_trash_impl(&state, "signature-command".to_string())
            .expect("restore signature");
    assert!(restored_signature
        .signatures
        .iter()
        .any(|signature| signature.id == "signature-command"));

    delete_signature_impl(&state, "signature-command".to_string()).expect("trash signature");
    let removed_signature =
        permanently_delete_signature_from_trash_impl(&state, "signature-command".to_string())
            .expect("delete signature permanently");
    assert!(removed_signature
        .trash
        .signatures
        .iter()
        .all(|signature| signature.signature.id != "signature-command"));
    assert!(removed_signature.drafts.is_some());
    assert!(removed_signature.draft_history.is_some());
    assert!(removed_signature.templates.is_some());
}

#[test]
fn memo_commands_round_trip() {
    let (state, _directory) = make_state();

    let memo = save_memo_impl(
        &state,
        MemoInput {
            id: "memo-1".to_string(),
            title: "打ち合わせ".to_string(),
            is_pinned: true,
            body: "確認事項".to_string(),
        },
    )
    .expect("save memo");

    assert_eq!(memo.id, "memo-1");
    assert_eq!(memo.title, "打ち合わせ");
    assert_eq!(memo.is_pinned, true);
    assert_eq!(memo.body, "確認事項");

    let snapshot = load_snapshot_impl(&state).expect("load snapshot");
    assert_eq!(snapshot.memos[0].title, "打ち合わせ");
    assert_eq!(snapshot.memos[0].body, "確認事項");

    let deleted = delete_memo_impl(&state, "memo-1".to_string()).expect("delete memo");
    assert_eq!(deleted.trashed_memo.memo.id, "memo-1");

    let restored =
        restore_memo_from_trash_impl(&state, "memo-1".to_string()).expect("restore memo");
    assert_eq!(restored.id, "memo-1");

    delete_memo_impl(&state, "memo-1".to_string()).expect("delete memo");
    let deleted_permanently = permanently_delete_memo_from_trash_impl(&state, "memo-1".to_string())
        .expect("delete memo permanently");
    assert!(deleted_permanently
        .trash
        .memos
        .iter()
        .all(|memo| memo.memo.id != "memo-1"));
}

#[test]
fn settings_and_logs_commands_round_trip() {
    let (state, _directory) = make_state();

    let initial = load_logging_settings_impl(&state).expect("load settings");
    assert_eq!(initial.mode, LoggingMode::ErrorsOnly);
    let initial_proofreading =
        load_proofreading_settings_impl(&state).expect("load proofreading settings");
    assert!(initial_proofreading.disabled_rule_ids.is_empty());

    let saved = save_logging_settings_impl(
        &state,
        LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
    )
    .expect("save settings");
    assert_eq!(saved.retention_days, 30);
    let saved_proofreading = save_proofreading_settings_impl(
        &state,
        ProofreadingSettingsInput {
            disabled_rule_ids: vec![" whitespace.trailing ".to_string(), "prh".to_string()],
        },
    )
    .expect("save proofreading settings");
    assert_eq!(
        saved_proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let recent = load_recent_logs_impl(&state, Some(5)).expect("load recent logs");
    assert!(recent.len() <= 5);

    let cleared = clear_logs_impl(&state).expect("clear logs");
    assert_eq!(cleared.file_count, 0);
}

#[test]
fn backup_commands_export_and_import_state() {
    let (state, directory) = make_state();
    let export_path = directory.path().join("backup.maildraft.json");

    save_template_impl(
        &state,
        TemplateInput {
            id: "template-backup".to_string(),
            name: "ご案内".to_string(),
            is_pinned: false,
            subject: "ご案内".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "本文です。".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            signature_id: Some("signature-default".to_string()),
        },
    )
    .expect("save template");

    let written = export_backup_impl(&state, export_path.display().to_string()).expect("export");
    assert_eq!(written, export_path.display().to_string());
    assert!(fs::exists(&export_path).expect("backup exists"));

    delete_template_impl(&state, "template-backup".to_string()).expect("trash template");
    let imported = import_backup_impl(&state, export_path.display().to_string()).expect("import");
    assert!(imported
        .snapshot
        .templates
        .iter()
        .any(|template| template.id == "template-backup"));
}

#[test]
fn backup_default_file_name_matches_frontend_format() {
    assert_eq!(
        backup_default_file_name_from_parts(2024, 1, 2, 3, 4),
        "maildraft-backup-20240102-0304.json"
    );
}

#[test]
fn empty_trash_command_clears_all_trash_kinds() {
    let (state, _directory) = make_state();

    delete_draft_impl(&state, "draft-welcome".to_string()).expect("trash draft");
    delete_template_impl(&state, "template-thanks".to_string()).expect("trash template");
    delete_signature_impl(&state, "signature-default".to_string()).expect("trash signature");
    save_memo_impl(
        &state,
        MemoInput {
            id: "memo-trash".to_string(),
            title: "削除予定".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        },
    )
    .expect("save memo");
    delete_memo_impl(&state, "memo-trash".to_string()).expect("trash memo");

    let emptied = empty_trash_impl(&state).expect("empty trash");
    assert!(emptied.trash.drafts.is_empty());
    assert!(emptied.trash.templates.is_empty());
    assert!(emptied.trash.signatures.is_empty());
    assert!(emptied.trash.memos.is_empty());
    assert!(emptied.drafts.is_some());
}

#[test]
fn empty_trash_command_reports_only_the_collections_affected_by_cleanup() {
    let (memo_state, _directory) = make_state();
    save_memo_impl(
        &memo_state,
        MemoInput {
            id: "memo-only".to_string(),
            title: "メモ".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        },
    )
    .expect("save memo");
    delete_memo_impl(&memo_state, "memo-only".to_string()).expect("trash memo");

    let emptied_memo = empty_trash_impl(&memo_state).expect("empty memo trash");
    assert_eq!(emptied_memo.drafts.is_none(), true);
    assert_eq!(emptied_memo.draft_history.is_none(), true);
    assert_eq!(emptied_memo.templates.is_none(), true);

    let (template_state, _directory) = make_state();
    delete_template_impl(&template_state, "template-thanks".to_string()).expect("trash template");

    let emptied_template = empty_trash_impl(&template_state).expect("empty template trash");
    assert_eq!(emptied_template.drafts.is_some(), true);
    assert_eq!(emptied_template.draft_history.is_some(), true);
    assert_eq!(emptied_template.templates.is_none(), true);

    let (signature_state, _directory) = make_state();
    delete_signature_impl(&signature_state, "signature-default".to_string())
        .expect("trash signature");

    let emptied_signature = empty_trash_impl(&signature_state).expect("empty signature trash");
    assert_eq!(emptied_signature.drafts.is_some(), true);
    assert_eq!(emptied_signature.draft_history.is_some(), true);
    assert_eq!(emptied_signature.templates.is_some(), true);
}

#[test]
fn signature_commands_keep_exactly_one_default_signature_across_save_delete_and_restore() {
    let (state, _directory) = make_state();

    let saved = save_signature_impl(
        &state,
        SignatureInput {
            id: "signature-alt".to_string(),
            name: "営業署名".to_string(),
            is_pinned: true,
            body: "営業部".to_string(),
            is_default: true,
        },
    )
    .expect("save signature");
    assert_eq!(
        saved
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(
        saved
            .signatures
            .iter()
            .find(|signature| signature.id == "signature-alt")
            .map(|signature| signature.is_default),
        Some(true)
    );

    let deleted =
        delete_signature_impl(&state, "signature-alt".to_string()).expect("delete signature");
    assert_eq!(
        deleted
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(
        deleted
            .signatures
            .iter()
            .find(|signature| signature.id == "signature-default")
            .map(|signature| signature.is_default),
        Some(true)
    );

    let restored = restore_signature_from_trash_impl(&state, "signature-alt".to_string())
        .expect("restore signature");
    assert_eq!(
        restored
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(
        restored
            .signatures
            .iter()
            .find(|signature| signature.id == "signature-default")
            .map(|signature| signature.is_default),
        Some(true)
    );
    assert_eq!(
        restored
            .signatures
            .iter()
            .find(|signature| signature.id == "signature-alt")
            .map(|signature| signature.is_default),
        Some(false)
    );
}

#[test]
fn restore_draft_command_impl_returns_cleaned_references_after_related_items_are_purged() {
    let (state, _directory) = make_state();

    delete_draft_impl(&state, "draft-welcome".to_string()).expect("trash draft");
    delete_template_impl(&state, "template-thanks".to_string()).expect("trash template");
    delete_signature_impl(&state, "signature-default".to_string()).expect("trash signature");
    permanently_delete_template_from_trash_impl(&state, "template-thanks".to_string())
        .expect("purge template");
    permanently_delete_signature_from_trash_impl(&state, "signature-default".to_string())
        .expect("purge signature");

    let restored =
        restore_draft_from_trash_impl(&state, "draft-welcome".to_string()).expect("restore draft");

    assert_eq!(restored.draft.template_id, None);
    assert_eq!(restored.draft.signature_id, None);
    assert_eq!(
        restored
            .draft_history
            .iter()
            .all(|entry| entry.template_id.is_none() && entry.signature_id.is_none()),
        true
    );
}

#[test]
fn restore_template_command_impl_returns_a_cleaned_signature_reference_after_signature_purge() {
    let (state, _directory) = make_state();

    delete_template_impl(&state, "template-thanks".to_string()).expect("trash template");
    delete_signature_impl(&state, "signature-default".to_string()).expect("trash signature");
    permanently_delete_signature_from_trash_impl(&state, "signature-default".to_string())
        .expect("purge signature");

    let restored = restore_template_from_trash_impl(&state, "template-thanks".to_string())
        .expect("restore template");

    assert_eq!(restored.template.signature_id, None);
}

#[test]
fn command_impls_report_missing_entities_and_boundary_inputs() {
    let (state, directory) = make_state();

    assert_eq!(
        delete_draft_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した下書きが見つかりませんでした。"
    );
    assert_eq!(
        restore_draft_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        restore_draft_history_impl(&state, "draft-welcome".to_string(), "missing".to_string())
            .unwrap_err(),
        "指定した履歴が見つかりませんでした。"
    );
    assert_eq!(
        delete_memo_impl(&state, "missing".to_string()).unwrap_err(),
        "指定したメモが見つかりませんでした。"
    );
    assert_eq!(
        restore_memo_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        delete_template_impl(&state, "missing".to_string()).unwrap_err(),
        "指定したテンプレートが見つかりませんでした。"
    );
    assert_eq!(
        restore_template_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        delete_signature_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した署名が見つかりませんでした。"
    );
    assert_eq!(
        restore_signature_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        permanently_delete_draft_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        permanently_delete_memo_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        permanently_delete_template_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        permanently_delete_signature_from_trash_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        delete_variable_preset_impl(&state, "missing".to_string()).unwrap_err(),
        "指定した変数値セットが見つかりませんでした。"
    );

    for index in 0..3 {
        save_memo_impl(
            &state,
            MemoInput {
                id: format!("memo-{index}"),
                title: format!("ログ {index}"),
                is_pinned: false,
                body: "本文".to_string(),
            },
        )
        .expect("save memo");
    }

    let all_logs = load_recent_logs_impl(&state, Some(200)).unwrap();
    assert_eq!(load_recent_logs_impl(&state, Some(0)).unwrap().len(), 1);
    assert_eq!(
        load_recent_logs_impl(&state, None).unwrap().len(),
        all_logs.len().min(80)
    );
    assert_eq!(
        load_recent_logs_impl(&state, Some(999)).unwrap().len(),
        all_logs.len()
    );

    let invalid_backup = directory.path().join("invalid-backup.json");
    fs::write(&invalid_backup, "{\"version\":999}").expect("write invalid backup");
    assert_eq!(
        import_backup_impl(&state, invalid_backup.display().to_string()).unwrap_err(),
        "このバックアップ形式には対応していません。"
    );
    assert!(
        !export_backup_impl(&state, directory.path().display().to_string())
            .unwrap_err()
            .is_empty()
    );
}

#[test]
fn command_impl_results_serialize_as_compact_payloads() {
    let (state, _directory) = make_state();

    let saved_template = save_template_impl(
        &state,
        TemplateInput {
            id: "template-compact".to_string(),
            name: "compact".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "本文".to_string(),
            closing: String::new(),
            signature_id: Some("signature-default".to_string()),
        },
    )
    .expect("save template");
    let saved_template_json = serde_json::to_value(&saved_template).expect("serialize template");
    assert_eq!(
        saved_template_json,
        json!({ "template": saved_template.template })
    );

    let saved_signature = save_signature_impl(
        &state,
        SignatureInput {
            id: "signature-compact".to_string(),
            name: "compact".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
            is_default: false,
        },
    )
    .expect("save signature");
    let saved_signature_json = serde_json::to_value(&saved_signature).expect("serialize signature");
    assert_eq!(
        saved_signature_json,
        json!({ "signatures": saved_signature.signatures })
    );

    let deleted_template =
        delete_template_impl(&state, "template-compact".to_string()).expect("delete template");
    let deleted_template_json =
        serde_json::to_value(&deleted_template).expect("serialize deleted template");
    assert_eq!(
        deleted_template_json,
        json!({ "trashedTemplate": deleted_template.trashed_template })
    );
}

#[test]
fn trash_mutation_commands_omit_unaffected_fields_from_json_payloads() {
    let (memo_state, _directory) = make_state();
    save_memo_impl(
        &memo_state,
        MemoInput {
            id: "memo-json".to_string(),
            title: "メモ".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        },
    )
    .expect("save memo");
    delete_memo_impl(&memo_state, "memo-json".to_string()).expect("trash memo");

    let memo_mutation =
        permanently_delete_memo_from_trash_impl(&memo_state, "memo-json".to_string())
            .expect("purge memo");
    let memo_json = serde_json::to_value(&memo_mutation).expect("serialize memo mutation");
    assert_eq!(memo_json.get("drafts"), None);
    assert_eq!(memo_json.get("draftHistory"), None);
    assert_eq!(memo_json.get("templates"), None);
    assert!(memo_json.get("trash").is_some());

    let (signature_state, _directory) = make_state();
    delete_signature_impl(&signature_state, "signature-default".to_string())
        .expect("trash signature");
    let signature_mutation = permanently_delete_signature_from_trash_impl(
        &signature_state,
        "signature-default".to_string(),
    )
    .expect("purge signature");
    let signature_json =
        serde_json::to_value(&signature_mutation).expect("serialize signature mutation");
    assert!(signature_json.get("drafts").is_some());
    assert!(signature_json.get("draftHistory").is_some());
    assert!(signature_json.get("templates").is_some());
    assert!(signature_json.get("trash").is_some());
}

#[test]
fn settings_commands_normalize_invalid_retention_in_their_contract() {
    let (state, _directory) = make_state();

    let saved = save_logging_settings_impl(
        &state,
        LoggingSettingsInput {
            mode: LoggingMode::Off,
            retention_days: 999,
        },
    )
    .expect("save settings");
    let saved_json = serde_json::to_value(&saved).expect("serialize settings");

    assert_eq!(saved.retention_days, 14);
    assert_eq!(saved_json["mode"], json!("off"));
    assert_eq!(saved_json["retentionDays"], json!(14));

    let saved_proofreading = save_proofreading_settings_impl(
        &state,
        ProofreadingSettingsInput {
            disabled_rule_ids: vec![
                " ".to_string(),
                " prh ".to_string(),
                "whitespace.trailing".to_string(),
                "prh".to_string(),
            ],
        },
    )
    .expect("save proofreading settings");
    let proofreading_json =
        serde_json::to_value(&saved_proofreading).expect("serialize proofreading settings");

    assert_eq!(
        saved_proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
    assert_eq!(
        proofreading_json["disabledRuleIds"],
        json!(["prh", "whitespace.trailing"])
    );
}

#[test]
fn restore_draft_command_impl_returns_history_only_for_the_restored_draft() {
    let (state, _directory) = make_state();

    save_draft_impl(
        &state,
        DraftInput {
            id: "draft-secondary".to_string(),
            title: "二件目".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "本文".to_string(),
            closing: String::new(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
    )
    .expect("save draft");
    save_draft_impl(
        &state,
        DraftInput {
            id: "draft-secondary".to_string(),
            title: "二件目".to_string(),
            is_pinned: false,
            subject: "更新件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "更新本文".to_string(),
            closing: String::new(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
    )
    .expect("update draft");
    delete_draft_impl(&state, "draft-welcome".to_string()).expect("trash primary");

    let restored =
        restore_draft_from_trash_impl(&state, "draft-welcome".to_string()).expect("restore");

    assert_eq!(restored.draft.id, "draft-welcome");
    assert_eq!(
        restored
            .draft_history
            .iter()
            .all(|entry| entry.draft_id == "draft-welcome"),
        true
    );
}

#[test]
fn tauri_command_wrappers_round_trip_mutations_without_leaking_other_collections() {
    let (state, _directory) = make_state();

    let initial = load_snapshot(as_tauri_state(&state)).expect("load snapshot");
    assert_eq!(initial.drafts.len(), 1);
    assert_eq!(
        load_startup_notice(as_tauri_state(&state)).expect("load startup notice"),
        None
    );

    let saved_memo = save_memo(
        as_tauri_state(&state),
        MemoInput {
            id: "memo-wrapper".to_string(),
            title: "wrapper".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        },
    )
    .expect("save memo");
    assert_eq!(saved_memo.id, "memo-wrapper");

    let deleted_memo =
        delete_memo(as_tauri_state(&state), "memo-wrapper".to_string()).expect("delete memo");
    assert_eq!(deleted_memo.trashed_memo.memo.id, "memo-wrapper");

    let restored_memo = restore_memo_from_trash(as_tauri_state(&state), "memo-wrapper".to_string())
        .expect("restore memo");
    assert_eq!(restored_memo.id, "memo-wrapper");

    delete_memo(as_tauri_state(&state), "memo-wrapper".to_string()).expect("trash memo");
    let purged_memo =
        permanently_delete_memo_from_trash(as_tauri_state(&state), "memo-wrapper".to_string())
            .expect("purge memo");
    assert!(purged_memo
        .trash
        .memos
        .iter()
        .all(|entry| entry.memo.id != "memo-wrapper"));
    assert!(purged_memo.drafts.is_none());
    assert!(purged_memo.templates.is_none());

    let saved_preset = save_variable_preset(
        as_tauri_state(&state),
        VariablePresetInput {
            id: "preset-wrapper".to_string(),
            name: "preset".to_string(),
            values: BTreeMap::from([("会社名".to_string(), "株式会社MailDraft".to_string())]),
        },
    )
    .expect("save preset");
    assert_eq!(saved_preset.variable_presets.len(), 1);

    let deleted_preset =
        delete_variable_preset(as_tauri_state(&state), "preset-wrapper".to_string())
            .expect("delete preset");
    assert!(deleted_preset.variable_presets.is_empty());

    let saved_draft = save_draft(
        as_tauri_state(&state),
        DraftInput {
            id: "draft-wrapper".to_string(),
            title: "wrapper".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "本文".to_string(),
            closing: String::new(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
    )
    .expect("save draft");
    assert_eq!(saved_draft.draft.id, "draft-wrapper");

    let trashed_draft =
        delete_draft(as_tauri_state(&state), "draft-wrapper".to_string()).expect("trash draft");
    assert_eq!(trashed_draft.trashed_draft.draft.id, "draft-wrapper");

    let restored_draft =
        restore_draft_from_trash(as_tauri_state(&state), "draft-wrapper".to_string())
            .expect("restore draft");
    assert_eq!(restored_draft.draft.id, "draft-wrapper");

    let updated_draft = save_draft(
        as_tauri_state(&state),
        DraftInput {
            id: "draft-wrapper".to_string(),
            title: "wrapper".to_string(),
            is_pinned: true,
            subject: "更新件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "更新本文".to_string(),
            closing: String::new(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
    )
    .expect("update draft");

    let restored_history = updated_draft
        .draft_history
        .iter()
        .find(|entry| entry.draft_id == "draft-wrapper")
        .expect("history entry")
        .id
        .clone();
    let snapshot_from_history = restore_draft_history(
        as_tauri_state(&state),
        "draft-wrapper".to_string(),
        restored_history,
    )
    .expect("restore draft history");
    assert_eq!(snapshot_from_history.draft.id, "draft-wrapper");

    delete_draft(as_tauri_state(&state), "draft-wrapper".to_string()).expect("trash again");
    let purged_draft =
        permanently_delete_draft_from_trash(as_tauri_state(&state), "draft-wrapper".to_string())
            .expect("purge draft");
    assert!(purged_draft
        .trash
        .drafts
        .iter()
        .all(|entry| entry.draft.id != "draft-wrapper"));
}

#[test]
fn tauri_command_wrappers_cover_template_signature_and_logging_contracts() {
    let (state, _directory) = make_state();

    let logging_before =
        load_logging_settings(as_tauri_state(&state)).expect("load logging settings");
    assert_eq!(logging_before.retention_days, 14);
    let proofreading_before =
        load_proofreading_settings(as_tauri_state(&state)).expect("load proofreading settings");
    assert!(proofreading_before.disabled_rule_ids.is_empty());

    let saved_template = save_template(
        as_tauri_state(&state),
        TemplateInput {
            id: "template-wrapper".to_string(),
            name: "wrapper".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "本文".to_string(),
            closing: String::new(),
            signature_id: Some("signature-default".to_string()),
        },
    )
    .expect("save template");
    assert_eq!(saved_template.template.id, "template-wrapper");

    let saved_signature = save_signature(
        as_tauri_state(&state),
        SignatureInput {
            id: "signature-wrapper".to_string(),
            name: "wrapper".to_string(),
            is_pinned: false,
            body: "署名".to_string(),
            is_default: false,
        },
    )
    .expect("save signature");
    assert!(saved_signature
        .signatures
        .iter()
        .any(|signature| signature.id == "signature-wrapper"));

    let deleted_template = delete_template(as_tauri_state(&state), "template-wrapper".to_string())
        .expect("delete template");
    assert_eq!(
        deleted_template.trashed_template.template.id,
        "template-wrapper"
    );

    let deleted_signature =
        delete_signature(as_tauri_state(&state), "signature-wrapper".to_string())
            .expect("delete signature");
    assert_eq!(
        deleted_signature.trashed_signature.signature.id,
        "signature-wrapper"
    );

    let restored_template =
        restore_template_from_trash(as_tauri_state(&state), "template-wrapper".to_string())
            .expect("restore template");
    assert_eq!(restored_template.template.id, "template-wrapper");

    let restored_signature =
        restore_signature_from_trash(as_tauri_state(&state), "signature-wrapper".to_string())
            .expect("restore signature");
    assert!(restored_signature
        .signatures
        .iter()
        .any(|signature| signature.id == "signature-wrapper"));

    delete_template(as_tauri_state(&state), "template-wrapper".to_string())
        .expect("trash template again");
    delete_signature(as_tauri_state(&state), "signature-wrapper".to_string())
        .expect("trash signature again");
    let purged_template = permanently_delete_template_from_trash(
        as_tauri_state(&state),
        "template-wrapper".to_string(),
    )
    .expect("purge template");
    assert!(purged_template
        .trash
        .templates
        .iter()
        .all(|entry| entry.template.id != "template-wrapper"));

    let purged_signature = permanently_delete_signature_from_trash(
        as_tauri_state(&state),
        "signature-wrapper".to_string(),
    )
    .expect("purge signature");
    assert!(purged_signature
        .trash
        .signatures
        .iter()
        .all(|entry| entry.signature.id != "signature-wrapper"));

    let saved_logging = save_logging_settings(
        as_tauri_state(&state),
        LoggingSettingsInput {
            mode: LoggingMode::ErrorsOnly,
            retention_days: 0,
        },
    )
    .expect("save logging");
    assert_eq!(saved_logging.retention_days, 14);
    let saved_proofreading = save_proofreading_settings(
        as_tauri_state(&state),
        ProofreadingSettingsInput {
            disabled_rule_ids: vec![" whitespace.trailing ".to_string(), "prh".to_string()],
        },
    )
    .expect("save proofreading");
    assert_eq!(
        saved_proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let recent_logs = load_recent_logs(as_tauri_state(&state), Some(5)).expect("load logs");
    assert!(recent_logs.len() <= 5);

    let cleared_logging = clear_logs(as_tauri_state(&state)).expect("clear logs");
    assert_eq!(cleared_logging.mode, saved_logging.mode);

    let emptied = empty_trash(as_tauri_state(&state)).expect("empty trash");
    assert!(emptied.trash.drafts.is_empty());
    assert!(emptied.trash.templates.is_empty());
    assert!(emptied.trash.signatures.is_empty());
    assert!(emptied.trash.memos.is_empty());
}

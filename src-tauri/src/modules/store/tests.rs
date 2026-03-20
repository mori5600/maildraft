use std::collections::BTreeMap;

use pretty_assertions::assert_eq;

use super::StoreSnapshot;
use crate::modules::{
    drafts::{DraftHistoryEntry, DraftInput},
    memo::MemoInput,
    signatures::{Signature, SignatureInput},
    templates::TemplateInput,
    variable_presets::VariablePresetInput,
};

#[test]
fn ensure_consistency_keeps_single_default_signature_and_cleans_broken_refs() {
    let mut store = StoreSnapshot::seeded();
    store.signatures = vec![
        Signature {
            id: "signature-a".to_string(),
            name: "A".to_string(),
            is_pinned: false,
            body: "A".to_string(),
            is_default: true,
            created_at: "0".to_string(),
            updated_at: "0".to_string(),
        },
        Signature {
            id: "signature-b".to_string(),
            name: "B".to_string(),
            is_pinned: false,
            body: "B".to_string(),
            is_default: true,
            created_at: "0".to_string(),
            updated_at: "0".to_string(),
        },
    ];
    store.drafts[0].signature_id = Some("missing-signature".to_string());
    store.templates[0].signature_id = Some("missing-signature".to_string());

    store.ensure_consistency();

    assert_eq!(
        store
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(store.drafts[0].signature_id, None);
    assert_eq!(store.templates[0].signature_id, None);
}

#[test]
fn upsert_draft_captures_history_for_meaningful_changes_after_interval() {
    let mut store = StoreSnapshot::seeded();
    let existing = store.drafts[0].clone();

    store.upsert_draft(
        DraftInput {
            id: existing.id.clone(),
            title: "更新後の下書き".to_string(),
            is_pinned: existing.is_pinned,
            subject: existing.subject.clone(),
            recipient: existing.recipient.clone(),
            opening: existing.opening.clone(),
            body: "更新後の本文".to_string(),
            closing: existing.closing.clone(),
            template_id: existing.template_id.clone(),
            signature_id: existing.signature_id.clone(),
            variable_values: existing.variable_values.clone(),
        },
        "100",
    );

    assert_eq!(store.draft_history.len(), 1);
    assert_eq!(store.draft_history[0].title, existing.title);
    assert_eq!(store.draft_history[0].body, existing.body);
    assert_eq!(store.drafts[0].title, "更新後の下書き");
    assert_eq!(store.drafts[0].body, "更新後の本文");
}

#[test]
fn delete_and_restore_draft_round_trips_draft_and_history() {
    let mut store = StoreSnapshot::seeded();
    let draft_id = store.drafts[0].id.clone();

    store.upsert_draft(
        DraftInput {
            id: draft_id.clone(),
            title: "復元テスト".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "更新後の本文".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: None,
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
        "100",
    );
    assert!(store.delete_draft(&draft_id, "120").is_some());

    assert_eq!(store.drafts.len(), 0);
    assert_eq!(store.trash.drafts.len(), 1);
    assert_eq!(store.trash.drafts[0].history.len(), 1);

    let restored = store.restore_draft_from_trash(&draft_id);

    assert!(restored.is_some());
    assert_eq!(store.drafts.len(), 1);
    assert_eq!(store.draft_history.len(), 1);
    assert_eq!(store.trash.drafts.len(), 0);
    assert_eq!(store.drafts[0].id, draft_id);
}

#[test]
fn restore_draft_from_trash_replaces_stale_active_history_for_same_id() {
    let mut store = StoreSnapshot::seeded();
    let draft_id = store.drafts[0].id.clone();
    let original_body = store.drafts[0].body.clone();

    store.upsert_draft(
        DraftInput {
            id: draft_id.clone(),
            title: "履歴付き".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "更新後".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
        },
        "100",
    );
    assert!(store.delete_draft(&draft_id, "120").is_some());

    let mut stale_history = DraftHistoryEntry::from_draft(&store.trash.drafts[0].draft, "130");
    stale_history.id = "history-stale".to_string();
    stale_history.body = "stale".to_string();
    store.draft_history.push(stale_history.clone());

    let restored = store.restore_draft_from_trash(&draft_id);

    assert!(restored.is_some());
    assert_eq!(store.draft_history.len(), 1);
    assert_eq!(
        store
            .draft_history
            .iter()
            .all(|entry| entry.id != stale_history.id),
        true
    );
    assert_eq!(store.draft_history[0].body, original_body);
}

#[test]
fn restore_draft_from_trash_rejects_duplicate_active_ids_without_mutating_trash() {
    let mut store = StoreSnapshot::seeded();
    let original_draft = store.drafts[0].clone();
    let draft_id = original_draft.id.clone();

    assert!(store.delete_draft(&draft_id, "10").is_some());
    store.upsert_draft(
        DraftInput {
            id: draft_id.clone(),
            title: "競合する下書き".to_string(),
            is_pinned: true,
            subject: "競合".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "active".to_string(),
            closing: String::new(),
            template_id: None,
            signature_id: None,
            variable_values: BTreeMap::new(),
        },
        "20",
    );

    assert_eq!(store.restore_draft_from_trash(&draft_id).is_none(), true);
    assert_eq!(store.drafts.len(), 1);
    assert_eq!(store.drafts[0].title, "競合する下書き");
    assert_eq!(store.trash.drafts.len(), 1);
    assert_eq!(store.trash.drafts[0].draft.title, original_draft.title);
}

#[test]
fn restore_template_from_trash_rejects_duplicate_active_ids_without_mutating_trash() {
    let mut store = StoreSnapshot::seeded();

    assert!(store.delete_template("template-thanks", "10").is_some());
    store.upsert_template(
        TemplateInput {
            id: "template-thanks".to_string(),
            name: "競合テンプレート".to_string(),
            is_pinned: true,
            subject: "競合".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "active".to_string(),
            closing: String::new(),
            signature_id: None,
        },
        "20",
    );

    assert_eq!(
        store
            .restore_template_from_trash("template-thanks")
            .is_none(),
        true
    );
    assert_eq!(store.templates.len(), 1);
    assert_eq!(store.templates[0].name, "競合テンプレート");
    assert_eq!(store.trash.templates.len(), 1);
    assert_eq!(store.trash.templates[0].template.id, "template-thanks");
}

#[test]
fn restore_signature_from_trash_rejects_duplicate_active_ids_without_mutating_trash() {
    let mut store = StoreSnapshot::seeded();

    assert!(store.delete_signature("signature-default", "10").is_some());
    store.upsert_signature(
        SignatureInput {
            id: "signature-default".to_string(),
            name: "競合署名".to_string(),
            is_pinned: true,
            body: "active".to_string(),
            is_default: false,
        },
        "20",
    );

    assert_eq!(
        store
            .restore_signature_from_trash("signature-default")
            .is_none(),
        true
    );
    assert_eq!(store.signatures.len(), 1);
    assert_eq!(store.signatures[0].name, "競合署名");
    assert_eq!(store.trash.signatures.len(), 1);
    assert_eq!(store.trash.signatures[0].signature.id, "signature-default");
}

#[test]
fn restore_memo_from_trash_rejects_duplicate_active_ids_without_mutating_trash() {
    let mut store = StoreSnapshot::seeded();

    store.upsert_memo(
        MemoInput {
            id: "memo-1".to_string(),
            title: "会議メモ".to_string(),
            is_pinned: false,
            body: "trash".to_string(),
        },
        "10",
    );
    assert!(store.delete_memo("memo-1", "11").is_some());
    store.upsert_memo(
        MemoInput {
            id: "memo-1".to_string(),
            title: "競合メモ".to_string(),
            is_pinned: true,
            body: "active".to_string(),
        },
        "20",
    );

    assert_eq!(store.restore_memo_from_trash("memo-1").is_none(), true);
    assert_eq!(store.memos.len(), 1);
    assert_eq!(store.memos[0].title, "競合メモ");
    assert_eq!(store.trash.memos.len(), 1);
    assert_eq!(store.trash.memos[0].memo.body, "trash");
}

#[test]
fn ensure_consistency_assigns_a_default_signature_when_missing() {
    let mut store = StoreSnapshot::seeded();
    store.signatures = vec![
        Signature {
            id: "signature-a".to_string(),
            name: "A".to_string(),
            is_pinned: false,
            body: "A".to_string(),
            is_default: false,
            created_at: "0".to_string(),
            updated_at: "0".to_string(),
        },
        Signature {
            id: "signature-b".to_string(),
            name: "B".to_string(),
            is_pinned: false,
            body: "B".to_string(),
            is_default: false,
            created_at: "0".to_string(),
            updated_at: "0".to_string(),
        },
    ];

    store.ensure_consistency();

    assert_eq!(
        store
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(store.signatures[0].is_default, true);
    assert_eq!(store.signatures[1].is_default, false);
}

#[test]
fn draft_history_skips_updates_inside_interval_but_keeps_later_changes() {
    let mut store = StoreSnapshot::seeded();
    let draft_id = store.drafts[0].id.clone();
    let initial_body = store.drafts[0].body.clone();

    for (timestamp, body) in [("100", "一回目"), ("110", "二回目"), ("150", "三回目")] {
        store.upsert_draft(
            DraftInput {
                id: draft_id.clone(),
                title: "履歴テスト".to_string(),
                is_pinned: false,
                subject: "件名".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: body.to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                template_id: None,
                signature_id: Some("signature-default".to_string()),
                variable_values: BTreeMap::new(),
            },
            timestamp,
        );
    }

    assert_eq!(store.draft_history.len(), 2);
    assert_eq!(store.draft_history[0].body, "二回目");
    assert_eq!(store.draft_history[1].body, initial_body);
    assert_eq!(store.drafts[0].body, "三回目");
}

#[test]
fn template_and_signature_trash_round_trip_and_default_switch_work() {
    let mut store = StoreSnapshot::seeded();

    store.upsert_signature(
        SignatureInput {
            id: "signature-alt".to_string(),
            name: "営業署名".to_string(),
            is_pinned: true,
            body: "営業部".to_string(),
            is_default: true,
        },
        "10",
    );
    assert_eq!(
        store
            .signatures
            .iter()
            .find(|signature| signature.id == "signature-alt")
            .map(|signature| signature.is_default),
        Some(true)
    );
    assert_eq!(
        store
            .signatures
            .iter()
            .find(|signature| signature.id == "signature-default")
            .map(|signature| signature.is_default),
        Some(false)
    );

    assert!(store.delete_template("template-thanks", "20").is_some());
    assert_eq!(store.templates.len(), 0);
    assert!(store
        .restore_template_from_trash("template-thanks")
        .is_some());
    assert_eq!(store.templates.len(), 1);

    assert!(store.delete_signature("signature-alt", "30").is_some());
    assert_eq!(
        store
            .trash
            .signatures
            .iter()
            .any(|entry| entry.signature.id == "signature-alt"),
        true
    );
    assert!(store
        .restore_signature_from_trash("signature-alt")
        .is_some());
    assert_eq!(
        store
            .signatures
            .iter()
            .any(|signature| signature.id == "signature-alt"),
        true
    );
}

#[test]
fn variable_presets_can_be_deleted_and_empty_trash_clears_all_kinds() {
    let mut store = StoreSnapshot::seeded();

    store.upsert_variable_preset(
        VariablePresetInput {
            id: "preset-a".to_string(),
            name: "A社向け".to_string(),
            values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
        },
        "10",
    );
    assert_eq!(store.delete_variable_preset("preset-a"), true);
    assert_eq!(store.delete_variable_preset("preset-a"), false);

    store.upsert_template(
        TemplateInput {
            id: "template-extra".to_string(),
            name: "追加".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "".to_string(),
            opening: "冒頭".to_string(),
            body: "本文".to_string(),
            closing: "末尾".to_string(),
            signature_id: Some("signature-default".to_string()),
        },
        "10",
    );
    assert!(store.delete_draft("draft-welcome", "20").is_some());
    assert!(store.delete_template("template-thanks", "21").is_some());
    assert!(store.delete_signature("signature-default", "22").is_some());
    store.upsert_memo(
        MemoInput {
            id: "memo-trash".to_string(),
            title: "削除予定".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        },
        "23",
    );
    assert!(store.delete_memo("memo-trash", "24").is_some());
    assert_eq!(store.trash.item_count(), 4);

    store.empty_trash();

    assert_eq!(store.trash.item_count(), 0);
}

#[test]
fn empty_trash_then_ensure_consistency_clears_references_that_only_survived_through_trash() {
    let mut store = StoreSnapshot::seeded();
    store
        .draft_history
        .push(DraftHistoryEntry::from_draft(&store.drafts[0], "5"));
    store.upsert_template(
        TemplateInput {
            id: "template-active".to_string(),
            name: "現役".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: String::new(),
            opening: String::new(),
            body: "本文".to_string(),
            closing: String::new(),
            signature_id: Some("signature-default".to_string()),
        },
        "10",
    );

    assert!(store.delete_template("template-thanks", "20").is_some());
    assert!(store.delete_signature("signature-default", "21").is_some());
    assert_eq!(
        store.drafts[0].template_id.as_deref(),
        Some("template-thanks")
    );
    assert_eq!(
        store.drafts[0].signature_id.as_deref(),
        Some("signature-default")
    );

    store.empty_trash();
    store.ensure_consistency();

    assert_eq!(store.trash.item_count(), 0);
    assert_eq!(store.drafts[0].template_id, None);
    assert_eq!(store.drafts[0].signature_id, None);
    assert_eq!(
        store
            .draft_history
            .iter()
            .all(|entry| entry.template_id.is_none() && entry.signature_id.is_none()),
        true
    );
    assert_eq!(
        store
            .templates
            .iter()
            .find(|template| template.id == "template-active")
            .and_then(|template| template.signature_id.as_deref()),
        None
    );
}

#[test]
fn memo_updates_in_place_after_first_save() {
    let mut store = StoreSnapshot::seeded();

    let first_saved = store.upsert_memo(
        MemoInput {
            id: "memo-1".to_string(),
            title: "会議メモ".to_string(),
            is_pinned: true,
            body: "決定事項".to_string(),
        },
        "10",
    );
    store.upsert_memo(
        MemoInput {
            id: "memo-1".to_string(),
            title: "会議メモ".to_string(),
            is_pinned: false,
            body: "決定事項\n宿題".to_string(),
        },
        "20",
    );

    assert_eq!(first_saved.id, "memo-1");
    assert_eq!(first_saved.is_pinned, true);
    assert_eq!(store.memos[0].title, "会議メモ");
    assert_eq!(store.memos[0].is_pinned, false);
    assert_eq!(store.memos[0].body, "決定事項\n宿題");
    assert_eq!(store.memos[0].created_at, "10");
    assert_eq!(store.memos[0].updated_at, "20");
}

#[test]
fn memo_delete_and_restore_round_trip() {
    let mut store = StoreSnapshot::seeded();

    store.upsert_memo(
        MemoInput {
            id: "memo-1".to_string(),
            title: "会議メモ".to_string(),
            is_pinned: false,
            body: "決定事項".to_string(),
        },
        "10",
    );

    let trashed = store.delete_memo("memo-1", "20").expect("trash memo");

    assert_eq!(trashed.memo.id, "memo-1");
    assert!(store.memos.is_empty());
    assert_eq!(store.trash.memos.len(), 1);

    let restored = store
        .restore_memo_from_trash("memo-1")
        .expect("restore memo");

    assert_eq!(restored.id, "memo-1");
    assert_eq!(store.memos.len(), 1);
    assert!(store.trash.memos.is_empty());
}

#[test]
fn ensure_consistency_migrates_legacy_singleton_memo() {
    let mut store = StoreSnapshot::seeded();
    store.legacy_memo = Some(crate::modules::memo::Memo {
        id: String::new(),
        title: "旧メモ".to_string(),
        is_pinned: false,
        body: "移行対象".to_string(),
        created_at: "10".to_string(),
        updated_at: "11".to_string(),
    });

    store.ensure_consistency();

    assert_eq!(store.memos.len(), 1);
    assert_eq!(store.memos[0].id, "memo-legacy");
    assert_eq!(store.memos[0].title, "旧メモ");
    assert_eq!(store.legacy_memo, None);
}

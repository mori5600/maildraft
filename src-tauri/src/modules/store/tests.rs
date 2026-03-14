use std::collections::BTreeMap;

use pretty_assertions::assert_eq;

use super::StoreSnapshot;
use crate::modules::{
    drafts::DraftInput,
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
    store.delete_draft(&draft_id, "120");

    assert_eq!(store.drafts.len(), 0);
    assert_eq!(store.trash.drafts.len(), 1);
    assert_eq!(store.trash.drafts[0].history.len(), 1);

    let restored = store.restore_draft_from_trash(&draft_id);

    assert_eq!(restored, true);
    assert_eq!(store.drafts.len(), 1);
    assert_eq!(store.draft_history.len(), 1);
    assert_eq!(store.trash.drafts.len(), 0);
    assert_eq!(store.drafts[0].id, draft_id);
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

    store.delete_template("template-thanks", "20");
    assert_eq!(store.templates.len(), 0);
    assert_eq!(store.restore_template_from_trash("template-thanks"), true);
    assert_eq!(store.templates.len(), 1);

    store.delete_signature("signature-alt", "30");
    assert_eq!(
        store
            .trash
            .signatures
            .iter()
            .any(|entry| entry.signature.id == "signature-alt"),
        true
    );
    assert_eq!(store.restore_signature_from_trash("signature-alt"), true);
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
    store.delete_draft("draft-welcome", "20");
    store.delete_template("template-thanks", "21");
    store.delete_signature("signature-default", "22");
    assert_eq!(store.trash.item_count(), 3);

    store.empty_trash();

    assert_eq!(store.trash.item_count(), 0);
}

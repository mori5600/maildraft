use super::*;

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
            tags: Vec::new(),
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
            tags: Vec::new(),
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
            tags: Vec::new(),
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

use std::collections::HashSet;

use crate::modules::{
    drafts::{Draft, DraftHistoryEntry},
    memo::Memo,
    signatures::Signature,
    store::StoreSnapshot,
    templates::Template,
    trash::TrashedDraft,
};

use super::{
    validate_collection_size, validate_id_like, validate_tags, validate_text_length,
    validate_unique_ids, validate_variables, MAX_COLLECTION_ITEMS, MAX_DRAFT_HISTORY_ITEMS,
    MAX_ID_LENGTH, MAX_MEMO_BODY_LENGTH, MAX_NAME_LENGTH, MAX_OPENING_LENGTH, MAX_RECIPIENT_LENGTH,
    MAX_SIGNATURE_BODY_LENGTH, MAX_SUBJECT_LENGTH, MAX_TEXT_FIELD_LENGTH, MAX_TITLE_LENGTH,
};

pub fn validate_store_snapshot(snapshot: &StoreSnapshot) -> Result<(), String> {
    validate_collection_size("下書き", snapshot.drafts.len(), MAX_COLLECTION_ITEMS)?;
    validate_collection_size(
        "テンプレート",
        snapshot.templates.len(),
        MAX_COLLECTION_ITEMS,
    )?;
    validate_collection_size("署名", snapshot.signatures.len(), MAX_COLLECTION_ITEMS)?;
    validate_collection_size("メモ", snapshot.memos.len(), MAX_COLLECTION_ITEMS)?;
    validate_collection_size(
        "変数値セット",
        snapshot.variable_presets.len(),
        MAX_COLLECTION_ITEMS,
    )?;
    validate_collection_size(
        "下書き履歴",
        snapshot.draft_history.len(),
        MAX_DRAFT_HISTORY_ITEMS,
    )?;
    validate_collection_size("ゴミ箱", snapshot.trash.item_count(), MAX_COLLECTION_ITEMS)?;

    validate_unique_ids(
        snapshot.drafts.iter().map(|draft| draft.id.as_str()).chain(
            snapshot
                .trash
                .drafts
                .iter()
                .map(|entry| entry.draft.id.as_str()),
        ),
        "下書きID",
    )?;
    validate_unique_ids(
        snapshot
            .templates
            .iter()
            .map(|template| template.id.as_str())
            .chain(
                snapshot
                    .trash
                    .templates
                    .iter()
                    .map(|entry| entry.template.id.as_str()),
            ),
        "テンプレートID",
    )?;
    validate_unique_ids(
        snapshot
            .signatures
            .iter()
            .map(|signature| signature.id.as_str())
            .chain(
                snapshot
                    .trash
                    .signatures
                    .iter()
                    .map(|entry| entry.signature.id.as_str()),
            ),
        "署名ID",
    )?;
    validate_unique_ids(
        snapshot.memos.iter().map(|memo| memo.id.as_str()).chain(
            snapshot
                .trash
                .memos
                .iter()
                .map(|entry| entry.memo.id.as_str()),
        ),
        "メモID",
    )?;
    validate_unique_ids(
        snapshot
            .variable_presets
            .iter()
            .map(|preset| preset.id.as_str()),
        "変数値セットID",
    )?;
    validate_unique_ids(
        snapshot
            .draft_history
            .iter()
            .map(|entry| entry.id.as_str())
            .chain(
                snapshot
                    .trash
                    .drafts
                    .iter()
                    .flat_map(|entry| entry.history.iter().map(|history| history.id.as_str())),
            ),
        "下書き履歴ID",
    )?;

    let active_draft_ids = snapshot
        .drafts
        .iter()
        .map(|draft| draft.id.as_str())
        .collect::<HashSet<_>>();
    for entry in &snapshot.draft_history {
        validate_draft_history_entry(entry)?;
        if !active_draft_ids.contains(entry.draft_id.as_str()) {
            return Err("保存ファイルの下書き履歴参照が壊れています。".to_string());
        }
    }

    for draft in &snapshot.drafts {
        validate_draft(draft)?;
    }

    for trashed_draft in &snapshot.trash.drafts {
        validate_trashed_draft(trashed_draft)?;
    }

    for template in &snapshot.templates {
        validate_template(template)?;
    }

    for entry in &snapshot.trash.templates {
        validate_template(&entry.template)?;
    }

    for signature in &snapshot.signatures {
        validate_signature(signature)?;
    }

    for entry in &snapshot.trash.signatures {
        validate_signature(&entry.signature)?;
    }

    for memo in &snapshot.memos {
        validate_memo(memo)?;
    }

    for entry in &snapshot.trash.memos {
        validate_memo(&entry.memo)?;
    }

    for preset in &snapshot.variable_presets {
        validate_id_like(&preset.id, "変数値セットID", MAX_ID_LENGTH)?;
        validate_text_length(&preset.name, "変数値セット名", MAX_NAME_LENGTH)?;
        validate_variables(&preset.values)?;
    }

    Ok(())
}

fn validate_draft(draft: &Draft) -> Result<(), String> {
    validate_id_like(&draft.id, "下書きID", MAX_ID_LENGTH)?;
    validate_text_length(&draft.title, "下書きタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&draft.subject, "件名", MAX_SUBJECT_LENGTH)?;
    validate_text_length(&draft.recipient, "宛先", MAX_RECIPIENT_LENGTH)?;
    validate_text_length(&draft.opening, "書き出し", MAX_OPENING_LENGTH)?;
    validate_text_length(&draft.body, "本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_text_length(&draft.closing, "結び", MAX_OPENING_LENGTH)?;
    validate_variables(&draft.variable_values)?;
    validate_tags(&draft.tags, "タグ")?;
    Ok(())
}

fn validate_draft_history_entry(entry: &DraftHistoryEntry) -> Result<(), String> {
    validate_id_like(&entry.id, "下書き履歴ID", MAX_ID_LENGTH)?;
    validate_id_like(&entry.draft_id, "下書きID", MAX_ID_LENGTH)?;
    validate_text_length(&entry.title, "下書きタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&entry.subject, "件名", MAX_SUBJECT_LENGTH)?;
    validate_text_length(&entry.recipient, "宛先", MAX_RECIPIENT_LENGTH)?;
    validate_text_length(&entry.opening, "書き出し", MAX_OPENING_LENGTH)?;
    validate_text_length(&entry.body, "本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_text_length(&entry.closing, "結び", MAX_OPENING_LENGTH)?;
    validate_variables(&entry.variable_values)?;
    validate_tags(&entry.tags, "タグ")?;
    Ok(())
}

fn validate_memo(memo: &Memo) -> Result<(), String> {
    validate_id_like(&memo.id, "メモID", MAX_ID_LENGTH)?;
    validate_text_length(&memo.title, "メモタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&memo.body, "メモ本文", MAX_MEMO_BODY_LENGTH)?;
    validate_tags(&memo.tags, "タグ")?;
    Ok(())
}

fn validate_signature(signature: &Signature) -> Result<(), String> {
    validate_id_like(&signature.id, "署名ID", MAX_ID_LENGTH)?;
    validate_text_length(&signature.name, "署名名", MAX_NAME_LENGTH)?;
    validate_text_length(&signature.body, "署名本文", MAX_SIGNATURE_BODY_LENGTH)?;
    Ok(())
}

fn validate_template(template: &Template) -> Result<(), String> {
    validate_id_like(&template.id, "テンプレートID", MAX_ID_LENGTH)?;
    validate_text_length(&template.name, "テンプレート名", MAX_NAME_LENGTH)?;
    validate_text_length(&template.subject, "件名", MAX_SUBJECT_LENGTH)?;
    validate_text_length(&template.recipient, "宛先", MAX_RECIPIENT_LENGTH)?;
    validate_text_length(&template.opening, "書き出し", MAX_OPENING_LENGTH)?;
    validate_text_length(&template.body, "本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_text_length(&template.closing, "結び", MAX_OPENING_LENGTH)?;
    validate_tags(&template.tags, "タグ")?;
    Ok(())
}

fn validate_trashed_draft(trashed_draft: &TrashedDraft) -> Result<(), String> {
    validate_draft(&trashed_draft.draft)?;
    validate_collection_size(
        "下書き履歴",
        trashed_draft.history.len(),
        MAX_DRAFT_HISTORY_ITEMS,
    )?;
    for entry in &trashed_draft.history {
        validate_draft_history_entry(entry)?;
        if entry.draft_id != trashed_draft.draft.id {
            return Err("保存ファイルのゴミ箱内の下書き履歴参照が壊れています。".to_string());
        }
    }

    Ok(())
}

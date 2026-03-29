use crate::{
    app::settings::{AppSettings, ProofreadingSettingsInput},
    modules::{
        blocks::ContentBlockInput, drafts::DraftInput, memo::MemoInput,
        signatures::SignatureInput, store::StoreSnapshot,
        templates::TemplateInput, variable_presets::VariablePresetInput,
    },
};

use super::{
    validate_id_like, validate_tags, validate_text_length, validate_variables, HashSet,
    MAX_DISABLED_RULE_IDS, MAX_ID_LENGTH, MAX_MEMO_BODY_LENGTH, MAX_NAME_LENGTH,
    MAX_OPENING_LENGTH, MAX_RECIPIENT_LENGTH, MAX_RULE_ID_LENGTH, MAX_SIGNATURE_BODY_LENGTH,
    MAX_SUBJECT_LENGTH, MAX_TEXT_FIELD_LENGTH, MAX_TITLE_LENGTH,
};

pub fn validate_app_settings(settings: &AppSettings) -> Result<(), String> {
    let disabled_rule_ids = &settings.proofreading.disabled_rule_ids;
    if disabled_rule_ids.len() > MAX_DISABLED_RULE_IDS {
        return Err("設定ファイルの無効化ルール数が上限を超えています。".to_string());
    }

    for rule_id in disabled_rule_ids {
        validate_id_like(rule_id, "校正ルールID", MAX_RULE_ID_LENGTH)?;
    }

    Ok(())
}

pub fn validate_proofreading_settings_input(
    input: &ProofreadingSettingsInput,
) -> Result<(), String> {
    if input.disabled_rule_ids.len() > MAX_DISABLED_RULE_IDS {
        return Err("無効化する校正ルール数が上限を超えています。".to_string());
    }

    for rule_id in input
        .disabled_rule_ids
        .iter()
        .map(|rule_id| rule_id.trim())
        .filter(|rule_id| !rule_id.is_empty())
        .collect::<HashSet<_>>()
    {
        validate_text_length(rule_id, "校正ルールID", MAX_RULE_ID_LENGTH)?;
    }

    Ok(())
}

pub fn validate_draft_input(input: &DraftInput, store: &StoreSnapshot) -> Result<(), String> {
    validate_id_like(&input.id, "下書きID", MAX_ID_LENGTH)?;
    validate_text_length(&input.title, "下書きタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&input.subject, "件名", MAX_SUBJECT_LENGTH)?;
    validate_text_length(&input.recipient, "宛先", MAX_RECIPIENT_LENGTH)?;
    validate_text_length(&input.opening, "書き出し", MAX_OPENING_LENGTH)?;
    validate_text_length(&input.body, "本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_text_length(&input.closing, "結び", MAX_OPENING_LENGTH)?;
    validate_variables(&input.variable_values)?;
    validate_tags(&input.tags, "タグ")?;

    validate_known_template_id(input.template_id.as_deref(), store)?;
    validate_known_signature_id(input.signature_id.as_deref(), store)?;

    Ok(())
}

pub fn validate_memo_input(input: &MemoInput) -> Result<(), String> {
    validate_id_like(&input.id, "メモID", MAX_ID_LENGTH)?;
    validate_text_length(&input.title, "メモタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&input.body, "メモ本文", MAX_MEMO_BODY_LENGTH)?;
    validate_tags(&input.tags, "タグ")?;
    Ok(())
}

pub fn validate_block_input(input: &ContentBlockInput) -> Result<(), String> {
    validate_id_like(&input.id, "文面ブロックID", MAX_ID_LENGTH)?;
    validate_text_length(&input.name, "文面ブロック名", MAX_NAME_LENGTH)?;
    validate_text_length(&input.body, "文面ブロック本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_tags(&input.tags, "タグ")?;
    Ok(())
}

pub fn validate_signature_input(input: &SignatureInput) -> Result<(), String> {
    validate_id_like(&input.id, "署名ID", MAX_ID_LENGTH)?;
    validate_text_length(&input.name, "署名名", MAX_NAME_LENGTH)?;
    validate_text_length(&input.body, "署名本文", MAX_SIGNATURE_BODY_LENGTH)?;
    Ok(())
}

pub fn validate_template_input(input: &TemplateInput, store: &StoreSnapshot) -> Result<(), String> {
    validate_id_like(&input.id, "テンプレートID", MAX_ID_LENGTH)?;
    validate_text_length(&input.name, "テンプレート名", MAX_NAME_LENGTH)?;
    validate_text_length(&input.subject, "件名", MAX_SUBJECT_LENGTH)?;
    validate_text_length(&input.recipient, "宛先", MAX_RECIPIENT_LENGTH)?;
    validate_text_length(&input.opening, "書き出し", MAX_OPENING_LENGTH)?;
    validate_text_length(&input.body, "本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_text_length(&input.closing, "結び", MAX_OPENING_LENGTH)?;
    validate_tags(&input.tags, "タグ")?;

    validate_known_signature_id(input.signature_id.as_deref(), store)?;

    Ok(())
}

pub fn validate_variable_preset_input(input: &VariablePresetInput) -> Result<(), String> {
    validate_id_like(&input.id, "変数値セットID", MAX_ID_LENGTH)?;
    validate_text_length(&input.name, "変数値セット名", MAX_NAME_LENGTH)?;
    validate_variables(&input.values)?;
    validate_tags(&input.tags, "タグ")?;
    Ok(())
}

fn validate_known_signature_id(id: Option<&str>, store: &StoreSnapshot) -> Result<(), String> {
    let Some(signature_id) = id else {
        return Ok(());
    };

    validate_id_like(signature_id, "署名ID", MAX_ID_LENGTH)?;
    let exists = store
        .signatures
        .iter()
        .any(|signature| signature.id == signature_id)
        || store
            .trash
            .signatures
            .iter()
            .any(|entry| entry.signature.id == signature_id);
    if !exists {
        return Err("選択した署名が見つかりませんでした。".to_string());
    }

    Ok(())
}

fn validate_known_template_id(id: Option<&str>, store: &StoreSnapshot) -> Result<(), String> {
    let Some(template_id) = id else {
        return Ok(());
    };

    validate_id_like(template_id, "テンプレートID", MAX_ID_LENGTH)?;
    let exists = store
        .templates
        .iter()
        .any(|template| template.id == template_id)
        || store
            .trash
            .templates
            .iter()
            .any(|entry| entry.template.id == template_id);
    if !exists {
        return Err("選択したテンプレートが見つかりませんでした。".to_string());
    }

    Ok(())
}

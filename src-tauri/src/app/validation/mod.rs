mod input;
mod io;
mod snapshot;
#[cfg(test)]
mod tests;

use std::collections::HashSet;

pub use input::{
    validate_app_settings, validate_draft_input, validate_memo_input,
    validate_proofreading_settings_input, validate_signature_input, validate_template_input,
    validate_variable_preset_input,
};
pub use io::{
    ensure_content_size, read_text_file_with_limit, validate_export_backup_path,
    validate_import_backup_path,
};
pub use snapshot::validate_store_snapshot;

pub const MAX_BACKUP_FILE_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_SETTINGS_FILE_BYTES: u64 = 256 * 1024;
pub const MAX_STORE_FILE_BYTES: u64 = 8 * 1024 * 1024;

const MAX_COLLECTION_ITEMS: usize = 5_000;
const MAX_DRAFT_HISTORY_ITEMS: usize = 20_000;
const MAX_DISABLED_RULE_IDS: usize = 100;
const MAX_ID_LENGTH: usize = 128;
const MAX_MEMO_BODY_LENGTH: usize = 50_000;
const MAX_NAME_LENGTH: usize = 200;
const MAX_OPENING_LENGTH: usize = 20_000;
const MAX_RECIPIENT_LENGTH: usize = 2_000;
const MAX_RULE_ID_LENGTH: usize = 100;
const MAX_SIGNATURE_BODY_LENGTH: usize = 10_000;
const MAX_SUBJECT_LENGTH: usize = 500;
const MAX_TAGS_PER_ITEM: usize = 20;
const MAX_TAG_LENGTH: usize = 40;
const MAX_TEXT_FIELD_LENGTH: usize = 20_000;
const MAX_TITLE_LENGTH: usize = 200;
const MAX_VARIABLE_KEY_LENGTH: usize = 100;
const MAX_VARIABLE_PAIRS: usize = 100;
const MAX_VARIABLE_VALUE_LENGTH: usize = 2_000;

fn validate_collection_size(label: &str, count: usize, max: usize) -> Result<(), String> {
    if count > max {
        return Err(format!("{label}件数が上限を超えています。"));
    }

    Ok(())
}

fn validate_id_like(value: &str, label: &str, max_length: usize) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{label}は空にできません。"));
    }

    if value != value.trim() {
        return Err(format!("{label}の前後に空白は使えません。"));
    }

    validate_text_length(value, label, max_length)
}

fn validate_text_length(value: &str, label: &str, max_length: usize) -> Result<(), String> {
    if value.chars().count() > max_length {
        return Err(format!(
            "{label}は {max_length} 文字以内で入力してください。"
        ));
    }

    Ok(())
}

fn validate_unique_ids<'a>(
    ids: impl IntoIterator<Item = &'a str>,
    label: &str,
) -> Result<(), String> {
    let mut seen = HashSet::new();
    for id in ids {
        validate_id_like(id, label, MAX_ID_LENGTH)?;
        if !seen.insert(id.to_string()) {
            return Err(format!("{label}が重複しています。"));
        }
    }

    Ok(())
}

fn validate_variables(values: &std::collections::BTreeMap<String, String>) -> Result<(), String> {
    if values.len() > MAX_VARIABLE_PAIRS {
        return Err("変数値の件数が上限を超えています。".to_string());
    }

    for (key, value) in values {
        validate_text_length(key, "変数名", MAX_VARIABLE_KEY_LENGTH)?;
        validate_text_length(value, "変数値", MAX_VARIABLE_VALUE_LENGTH)?;
    }

    Ok(())
}

fn validate_tags(tags: &[String], label: &str) -> Result<(), String> {
    if tags.len() > MAX_TAGS_PER_ITEM {
        return Err(format!(
            "{label}は {MAX_TAGS_PER_ITEM} 件以内で入力してください。"
        ));
    }

    let mut seen = HashSet::new();
    for tag in tags {
        if tag.trim().is_empty() {
            return Err(format!("{label}に空のタグは使えません。"));
        }

        if tag != tag.trim() {
            return Err(format!("{label}の前後に空白は使えません。"));
        }

        validate_text_length(tag, label, MAX_TAG_LENGTH)?;

        if !seen.insert(tag.to_string()) {
            return Err(format!("{label}が重複しています。"));
        }
    }

    Ok(())
}

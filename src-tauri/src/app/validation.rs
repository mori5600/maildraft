use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use crate::{
    app::settings::{AppSettings, ProofreadingSettingsInput},
    modules::{
        drafts::{Draft, DraftHistoryEntry, DraftInput},
        memo::{Memo, MemoInput},
        signatures::{Signature, SignatureInput},
        store::StoreSnapshot,
        templates::{Template, TemplateInput},
        trash::TrashedDraft,
        variable_presets::VariablePresetInput,
    },
};

pub const MAX_BACKUP_FILE_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_SETTINGS_FILE_BYTES: u64 = 256 * 1024;
pub const MAX_STORE_FILE_BYTES: u64 = 8 * 1024 * 1024;

const BACKUP_EXTENSION: &str = "json";
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
const MAX_TEXT_FIELD_LENGTH: usize = 20_000;
const MAX_TITLE_LENGTH: usize = 200;
const MAX_VARIABLE_KEY_LENGTH: usize = 100;
const MAX_VARIABLE_PAIRS: usize = 100;
const MAX_VARIABLE_VALUE_LENGTH: usize = 2_000;

pub fn ensure_content_size(
    content: &str,
    max_bytes: u64,
    too_large_message: &'static str,
) -> Result<(), String> {
    if content.len() as u64 > max_bytes {
        return Err(too_large_message.to_string());
    }

    Ok(())
}

pub fn read_text_file_with_limit(
    path: &Path,
    max_bytes: u64,
    too_large_message: &'static str,
) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.len() > max_bytes {
        return Err(too_large_message.to_string());
    }

    fs::read_to_string(path).map_err(|error| error.to_string())
}

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

pub fn validate_export_backup_path(
    path: &str,
    protected_paths: &[&Path],
) -> Result<PathBuf, String> {
    let backup_path = validate_backup_path_shape(
        path,
        "バックアップの書き出し先は絶対パスの .json ファイルを指定してください。",
    )?;

    let parent = backup_path
        .parent()
        .ok_or_else(|| "バックアップの書き出し先フォルダが見つかりませんでした。".to_string())?;
    let parent_metadata = fs::metadata(parent).map_err(|error| error.to_string())?;
    if !parent_metadata.is_dir() {
        return Err("バックアップの書き出し先フォルダが見つかりませんでした。".to_string());
    }

    if backup_path.exists() {
        let metadata = fs::symlink_metadata(&backup_path).map_err(|error| error.to_string())?;
        if !metadata.is_file() {
            return Err(
                "バックアップの書き出し先には通常のファイルを指定してください。".to_string(),
            );
        }
    }

    let normalized_backup_path = normalize_path_for_comparison(&backup_path)?;
    if protected_paths
        .iter()
        .filter_map(|protected| normalize_path_for_comparison(protected).ok())
        .any(|protected| protected == normalized_backup_path)
    {
        return Err("アプリの内部データファイルにはバックアップを書き出せません。".to_string());
    }

    Ok(backup_path)
}

pub fn validate_import_backup_path(path: &str) -> Result<PathBuf, String> {
    let backup_path = validate_backup_path_shape(
        path,
        "バックアップの読み込み元は絶対パスの .json ファイルを指定してください。",
    )?;
    let metadata = fs::symlink_metadata(&backup_path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("バックアップの読み込み元には通常のファイルを指定してください。".to_string());
    }

    Ok(backup_path)
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

pub fn validate_draft_input(input: &DraftInput, store: &StoreSnapshot) -> Result<(), String> {
    validate_id_like(&input.id, "下書きID", MAX_ID_LENGTH)?;
    validate_text_length(&input.title, "下書きタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&input.subject, "件名", MAX_SUBJECT_LENGTH)?;
    validate_text_length(&input.recipient, "宛先", MAX_RECIPIENT_LENGTH)?;
    validate_text_length(&input.opening, "書き出し", MAX_OPENING_LENGTH)?;
    validate_text_length(&input.body, "本文", MAX_TEXT_FIELD_LENGTH)?;
    validate_text_length(&input.closing, "結び", MAX_OPENING_LENGTH)?;
    validate_variables(&input.variable_values)?;

    validate_known_template_id(input.template_id.as_deref(), store)?;
    validate_known_signature_id(input.signature_id.as_deref(), store)?;

    Ok(())
}

pub fn validate_memo_input(input: &MemoInput) -> Result<(), String> {
    validate_id_like(&input.id, "メモID", MAX_ID_LENGTH)?;
    validate_text_length(&input.title, "メモタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&input.body, "メモ本文", MAX_MEMO_BODY_LENGTH)?;
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

    validate_known_signature_id(input.signature_id.as_deref(), store)?;

    Ok(())
}

pub fn validate_variable_preset_input(input: &VariablePresetInput) -> Result<(), String> {
    validate_id_like(&input.id, "変数値セットID", MAX_ID_LENGTH)?;
    validate_text_length(&input.name, "変数値セット名", MAX_NAME_LENGTH)?;
    validate_variables(&input.values)?;
    Ok(())
}

fn validate_backup_path_shape(
    path: &str,
    invalid_message: &'static str,
) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(invalid_message.to_string());
    }

    let backup_path = PathBuf::from(trimmed);
    let has_json_extension = backup_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(BACKUP_EXTENSION));

    if !backup_path.is_absolute() || !has_json_extension {
        return Err(invalid_message.to_string());
    }

    Ok(backup_path)
}

fn normalize_path_for_comparison(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return fs::canonicalize(path).map_err(|error| error.to_string());
    }

    let parent = path
        .parent()
        .ok_or_else(|| "バックアップの書き出し先フォルダが見つかりませんでした。".to_string())?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "バックアップファイル名が不正です。".to_string())?;
    let normalized_parent = fs::canonicalize(parent).map_err(|error| error.to_string())?;

    Ok(normalized_parent.join(file_name))
}

fn validate_collection_size(label: &str, count: usize, max: usize) -> Result<(), String> {
    if count > max {
        return Err(format!("{label}件数が上限を超えています。"));
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

fn validate_memo(memo: &Memo) -> Result<(), String> {
    validate_id_like(&memo.id, "メモID", MAX_ID_LENGTH)?;
    validate_text_length(&memo.title, "メモタイトル", MAX_TITLE_LENGTH)?;
    validate_text_length(&memo.body, "メモ本文", MAX_MEMO_BODY_LENGTH)?;
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
    Ok(())
}

fn validate_text_length(value: &str, label: &str, max_length: usize) -> Result<(), String> {
    if value.chars().count() > max_length {
        return Err(format!(
            "{label}は {max_length} 文字以内で入力してください。"
        ));
    }

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

#[cfg(test)]
mod tests {
    use std::fs::{self, File};

    use super::{
        read_text_file_with_limit, validate_export_backup_path, validate_import_backup_path,
        validate_store_snapshot, MAX_BACKUP_FILE_BYTES,
    };
    use crate::modules::store::StoreSnapshot;
    use tempfile::tempdir;

    #[test]
    fn backup_path_validation_requires_absolute_json_files() {
        let directory = tempdir().expect("tempdir");
        let file_path = directory.path().join("backup.json");

        assert!(validate_import_backup_path("backup.json").is_err());
        assert!(validate_export_backup_path("backup.txt", &[]).is_err());
        assert!(validate_export_backup_path(file_path.to_str().expect("path"), &[]).is_ok());
    }

    #[test]
    fn backup_path_validation_rejects_internal_files_even_with_noncanonical_paths() {
        let directory = tempdir().expect("tempdir");
        let nested = directory.path().join("nested");
        fs::create_dir_all(&nested).expect("create nested directory");

        let protected_path = directory.path().join("store.json");
        let noncanonical = nested.join("..").join("store.json");

        assert_eq!(
            validate_export_backup_path(
                noncanonical.to_str().expect("path"),
                &[protected_path.as_path()],
            )
            .unwrap_err(),
            "アプリの内部データファイルにはバックアップを書き出せません。"
        );
    }

    #[test]
    fn read_text_file_with_limit_rejects_oversized_files() {
        let directory = tempdir().expect("tempdir");
        let file_path = directory.path().join("large.json");
        let file = File::create(&file_path).expect("create file");
        file.set_len(MAX_BACKUP_FILE_BYTES + 1).expect("set len");

        assert_eq!(
            read_text_file_with_limit(&file_path, MAX_BACKUP_FILE_BYTES, "too large").unwrap_err(),
            "too large"
        );
    }

    #[test]
    fn store_snapshot_validation_rejects_duplicate_active_and_trashed_ids() {
        let mut snapshot = StoreSnapshot::seeded();
        snapshot
            .trash
            .drafts
            .push(crate::modules::trash::TrashedDraft {
                draft: snapshot.drafts[0].clone(),
                history: Vec::new(),
                deleted_at: "1".to_string(),
            });

        assert_eq!(
            validate_store_snapshot(&snapshot).unwrap_err(),
            "下書きIDが重複しています。"
        );
    }
}

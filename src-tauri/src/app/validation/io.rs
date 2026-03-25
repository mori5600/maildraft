use std::{
    fs,
    path::{Path, PathBuf},
};

const BACKUP_EXTENSION: &str = "json";

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

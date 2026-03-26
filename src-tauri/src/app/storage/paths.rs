use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub(super) fn quarantine_file(path: &Path) {
    if !path.exists() {
        return;
    }

    let _ = fs::rename(path, corrupt_path(path));
}

pub(super) fn backup_path(path: &Path) -> PathBuf {
    with_suffix(path, ".bak")
}

fn corrupt_path(path: &Path) -> PathBuf {
    with_suffix(path, &format!(".corrupt-{}", now_unix_millis()))
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("maildraft-data");
    path.with_file_name(format!("{}{}", file_name, suffix))
}

pub(super) fn now_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

use std::fs::{self, File};

use tempfile::tempdir;

use super::{
    read_text_file_with_limit, validate_export_backup_path, validate_import_backup_path,
    validate_store_snapshot, MAX_BACKUP_FILE_BYTES,
};
use crate::modules::store::StoreSnapshot;

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

use std::{fs, path::Path};

use super::{paths::backup_path, AppResult};

pub(super) fn write_json_safely(path: &Path, content: &str) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temporary_path = temporary_path(path);
    fs::write(&temporary_path, content).map_err(|error| error.to_string())?;

    if path.exists() {
        if let Err(error) = fs::copy(path, backup_path(path)) {
            let _ = fs::remove_file(&temporary_path);
            return Err(error.to_string());
        }
    }

    replace_file(&temporary_path, path)?;
    Ok(())
}

fn replace_file(source: &Path, destination: &Path) -> AppResult<()> {
    #[cfg(not(target_os = "windows"))]
    {
        fs::rename(source, destination).map_err(|error| error.to_string())
    }

    #[cfg(target_os = "windows")]
    {
        if destination.exists() {
            fs::remove_file(destination).map_err(|error| error.to_string())?;
        }
        fs::rename(source, destination).map_err(|error| error.to_string())
    }
}

fn temporary_path(path: &Path) -> std::path::PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("maildraft-data");
    path.with_file_name(format!("{}.tmp", file_name))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use pretty_assertions::assert_eq;
    use tempfile::tempdir;

    use super::{temporary_path, write_json_safely};
    use super::super::paths::backup_path;

    #[test]
    fn write_json_safely_creates_parent_directories_and_replaces_content() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("nested").join("maildraft.json");

        write_json_safely(&path, "{\"version\":1}").expect("initial write");
        write_json_safely(&path, "{\"version\":2}").expect("rewrite");

        assert_eq!(
            fs::read_to_string(&path).expect("read rewritten file"),
            "{\"version\":2}"
        );
        assert_eq!(
            fs::read_to_string(backup_path(&path)).expect("read backup"),
            "{\"version\":1}"
        );
        assert_eq!(temporary_path(&path).exists(), false);
    }

    #[test]
    fn write_json_safely_preserves_original_file_and_cleans_temp_when_backup_copy_fails() {
        let directory = tempdir().expect("tempdir");
        let path = directory.path().join("maildraft.json");

        fs::write(&path, "{\"version\":1}").expect("write original");
        fs::create_dir_all(backup_path(&path)).expect("block backup path");

        let error = write_json_safely(&path, "{\"version\":2}").unwrap_err();

        assert!(!error.is_empty());
        assert_eq!(
            fs::read_to_string(&path).expect("read original after failure"),
            "{\"version\":1}"
        );
        assert_eq!(temporary_path(&path).exists(), false);
    }
}

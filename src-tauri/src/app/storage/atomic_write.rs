use std::{fs, path::Path};

use super::{backup_path, AppResult};

pub(super) fn write_json_safely(path: &Path, content: &str) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temporary_path = temporary_path(path);
    fs::write(&temporary_path, content).map_err(|error| error.to_string())?;

    if path.exists() {
        fs::copy(path, backup_path(path)).map_err(|error| error.to_string())?;
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

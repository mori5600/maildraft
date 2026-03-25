use std::{fs, path::Path, time::Duration};

use rusqlite::{Connection, OptionalExtension};

pub(super) fn ensure_parent_directory(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub(super) fn configure_connection(connection: &Connection) -> Result<(), String> {
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub(super) fn settings_initialized(connection: &Connection) -> Result<bool, String> {
    initialization_flag(connection, "settings_initialized")
}

pub(super) fn store_initialized(connection: &Connection) -> Result<bool, String> {
    initialization_flag(connection, "store_initialized")
}

fn initialization_flag(connection: &Connection, column: &str) -> Result<bool, String> {
    let sql = format!("SELECT {column} FROM persistence_state WHERE id = 1");
    let value = connection
        .query_row(&sql, [], |row| row.get::<_, i64>(0))
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or(0);
    Ok(super::decode_bool(value))
}

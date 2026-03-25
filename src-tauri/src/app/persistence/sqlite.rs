mod connection;
mod read;
mod schema;
#[cfg(test)]
mod tests;
mod write;

use std::path::PathBuf;

use rusqlite::{Connection, Transaction};

use crate::{
    app::{
        settings::{AppSettings, LoggingMode},
        storage::LoadOutcome,
        validation::{validate_app_settings, validate_store_snapshot},
    },
    modules::store::StoreSnapshot,
};

use self::{
    connection::{
        configure_connection, ensure_parent_directory, settings_initialized, store_initialized,
    },
    read::{load_settings, load_store_snapshot},
    schema::apply_migrations,
    write::{
        clear_settings_tables, clear_store_tables, insert_settings, insert_store_snapshot,
        set_initialization_flags,
    },
};
use super::{PersistedAppState, PersistenceRepository};

#[derive(Debug, Clone)]
pub(crate) struct SqliteRepository {
    db_path: PathBuf,
}

impl SqliteRepository {
    pub(crate) fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub(crate) fn has_saved_state(&self) -> Result<bool, String> {
        if !self.db_path.exists() {
            return Ok(false);
        }

        let connection = self.open_connection()?;
        Ok(store_initialized(&connection)? || settings_initialized(&connection)?)
    }

    pub(crate) fn save_full_state(
        &self,
        snapshot: &StoreSnapshot,
        settings: &AppSettings,
    ) -> Result<(), String> {
        let mut snapshot = snapshot.clone();
        snapshot.ensure_consistency();
        validate_store_snapshot(&snapshot)?;

        let settings = settings.clone().normalized();
        validate_app_settings(&settings)?;

        self.with_transaction(|transaction| {
            clear_store_tables(transaction)?;
            clear_settings_tables(transaction)?;
            insert_settings(transaction, &settings)?;
            insert_store_snapshot(transaction, &snapshot)?;
            set_initialization_flags(transaction, Some(true), Some(true))?;
            Ok(())
        })
    }

    fn open_connection(&self) -> Result<Connection, String> {
        ensure_parent_directory(&self.db_path)?;

        let connection = Connection::open(&self.db_path).map_err(|error| error.to_string())?;
        configure_connection(&connection)?;
        apply_migrations(&connection)?;

        Ok(connection)
    }

    fn with_transaction<T>(
        &self,
        operation: impl FnOnce(&Transaction<'_>) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut connection = self.open_connection()?;
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        let result = operation(&transaction)?;
        transaction.commit().map_err(|error| error.to_string())?;
        Ok(result)
    }

    #[cfg(test)]
    fn open_connection_for_tests(&self) -> Result<Connection, String> {
        self.open_connection()
    }
}

impl PersistenceRepository for SqliteRepository {
    fn load_state(&self) -> Result<PersistedAppState, String> {
        if !self.db_path.exists() {
            return Ok(PersistedAppState {
                snapshot: StoreSnapshot::seeded(),
                settings: AppSettings::default(),
            });
        }

        let connection = self.open_connection()?;
        let settings = if settings_initialized(&connection)? {
            let settings = load_settings(&connection)?;
            validate_app_settings(&settings)?;
            settings
        } else {
            AppSettings::default()
        };

        let snapshot = if store_initialized(&connection)? {
            let mut snapshot = load_store_snapshot(&connection)?;
            snapshot.ensure_consistency();
            validate_store_snapshot(&snapshot)?;
            snapshot
        } else {
            StoreSnapshot::seeded()
        };

        Ok(PersistedAppState { snapshot, settings })
    }

    fn load_app_settings(&self) -> Result<LoadOutcome<AppSettings>, String> {
        if !self.db_path.exists() {
            return Ok(LoadOutcome {
                startup_notice: None,
                value: AppSettings::default(),
            });
        }

        let connection = self.open_connection()?;
        if !settings_initialized(&connection)? {
            return Ok(LoadOutcome {
                startup_notice: None,
                value: AppSettings::default(),
            });
        }

        let settings = load_settings(&connection)?;
        validate_app_settings(&settings)?;

        Ok(LoadOutcome {
            startup_notice: None,
            value: settings,
        })
    }

    fn load_store_snapshot(&self) -> Result<LoadOutcome<StoreSnapshot>, String> {
        if !self.db_path.exists() {
            return Ok(LoadOutcome {
                startup_notice: None,
                value: StoreSnapshot::seeded(),
            });
        }

        let connection = self.open_connection()?;
        if !store_initialized(&connection)? {
            return Ok(LoadOutcome {
                startup_notice: None,
                value: StoreSnapshot::seeded(),
            });
        }

        let mut snapshot = load_store_snapshot(&connection)?;
        snapshot.ensure_consistency();
        validate_store_snapshot(&snapshot)?;

        Ok(LoadOutcome {
            startup_notice: None,
            value: snapshot,
        })
    }

    fn save_app_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let settings = settings.clone().normalized();
        validate_app_settings(&settings)?;

        self.with_transaction(|transaction| {
            clear_settings_tables(transaction)?;
            insert_settings(transaction, &settings)?;
            set_initialization_flags(transaction, None, Some(true))?;
            Ok(())
        })
    }

    fn save_store_snapshot(&self, snapshot: &StoreSnapshot) -> Result<(), String> {
        let mut snapshot = snapshot.clone();
        snapshot.ensure_consistency();
        validate_store_snapshot(&snapshot)?;

        self.with_transaction(|transaction| {
            clear_store_tables(transaction)?;
            insert_store_snapshot(transaction, &snapshot)?;
            set_initialization_flags(transaction, Some(true), None)?;
            Ok(())
        })
    }

    fn save_state(&self, snapshot: &StoreSnapshot, settings: &AppSettings) -> Result<(), String> {
        self.save_full_state(snapshot, settings)
    }

    fn protected_backup_paths(&self) -> Vec<PathBuf> {
        vec![self.db_path.clone()]
    }
}

fn encode_bool(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn decode_bool(value: i64) -> bool {
    value != 0
}

fn decode_logging_mode(value: &str) -> Result<LoggingMode, rusqlite::Error> {
    match value {
        "off" => Ok(LoggingMode::Off),
        "errors_only" => Ok(LoggingMode::ErrorsOnly),
        "standard" => Ok(LoggingMode::Standard),
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

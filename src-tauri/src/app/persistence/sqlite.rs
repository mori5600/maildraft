use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

use rusqlite::{params, Connection, OptionalExtension, Transaction};

use crate::{
    app::{
        settings::{AppSettings, LoggingMode, LoggingSettings, ProofreadingSettings},
        storage::LoadOutcome,
        validation::{validate_app_settings, validate_store_snapshot},
    },
    modules::{
        drafts::{Draft, DraftHistoryEntry},
        memo::Memo,
        signatures::Signature,
        store::StoreSnapshot,
        templates::Template,
        trash::{TrashSnapshot, TrashedDraft, TrashedMemo, TrashedSignature, TrashedTemplate},
        variable_presets::VariablePreset,
    },
};

use super::{PersistedAppState, PersistenceRepository};

const SQLITE_SCHEMA_VERSION: i32 = 1;

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

fn ensure_parent_directory(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn configure_connection(connection: &Connection) -> Result<(), String> {
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

fn apply_migrations(connection: &Connection) -> Result<(), String> {
    let current_version = connection
        .pragma_query_value(None, "user_version", |row| row.get::<_, i32>(0))
        .map_err(|error| error.to_string())?;

    if current_version > SQLITE_SCHEMA_VERSION {
        return Err("SQLite スキーマのバージョンが新しすぎます。".to_string());
    }

    if current_version < 1 {
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS persistence_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    store_initialized INTEGER NOT NULL CHECK (store_initialized IN (0, 1)),
                    settings_initialized INTEGER NOT NULL CHECK (settings_initialized IN (0, 1))
                );

                INSERT OR IGNORE INTO persistence_state (id, store_initialized, settings_initialized)
                VALUES (1, 0, 0);

                CREATE TABLE IF NOT EXISTS settings_logging (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    mode TEXT NOT NULL CHECK (mode IN ('off', 'errors_only', 'standard')),
                    retention_days INTEGER NOT NULL CHECK (retention_days IN (7, 14, 30))
                );

                CREATE TABLE IF NOT EXISTS settings_proofreading_disabled_rules (
                    rule_id TEXT PRIMARY KEY,
                    sort_order INTEGER NOT NULL UNIQUE
                );

                CREATE TABLE IF NOT EXISTS signatures (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1)),
                    body TEXT NOT NULL,
                    is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    in_trash INTEGER NOT NULL CHECK (in_trash IN (0, 1)),
                    deleted_at TEXT,
                    sort_order INTEGER NOT NULL,
                    CHECK (
                        (in_trash = 0 AND deleted_at IS NULL)
                        OR (in_trash = 1 AND deleted_at IS NOT NULL)
                    ),
                    UNIQUE (in_trash, sort_order)
                );

                CREATE UNIQUE INDEX IF NOT EXISTS idx_signatures_single_default_active
                ON signatures (is_default)
                WHERE is_default = 1 AND in_trash = 0;

                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1)),
                    subject TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    opening TEXT NOT NULL,
                    body TEXT NOT NULL,
                    closing TEXT NOT NULL,
                    signature_id TEXT REFERENCES signatures (id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    in_trash INTEGER NOT NULL CHECK (in_trash IN (0, 1)),
                    deleted_at TEXT,
                    sort_order INTEGER NOT NULL,
                    CHECK (
                        (in_trash = 0 AND deleted_at IS NULL)
                        OR (in_trash = 1 AND deleted_at IS NOT NULL)
                    ),
                    UNIQUE (in_trash, sort_order)
                );

                CREATE TABLE IF NOT EXISTS drafts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1)),
                    subject TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    opening TEXT NOT NULL,
                    body TEXT NOT NULL,
                    closing TEXT NOT NULL,
                    template_id TEXT REFERENCES templates (id) ON DELETE SET NULL,
                    signature_id TEXT REFERENCES signatures (id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    in_trash INTEGER NOT NULL CHECK (in_trash IN (0, 1)),
                    deleted_at TEXT,
                    sort_order INTEGER NOT NULL,
                    CHECK (
                        (in_trash = 0 AND deleted_at IS NULL)
                        OR (in_trash = 1 AND deleted_at IS NOT NULL)
                    ),
                    UNIQUE (in_trash, sort_order)
                );

                CREATE TABLE IF NOT EXISTS draft_variable_values (
                    draft_id TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
                    variable_key TEXT NOT NULL,
                    variable_value TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (draft_id, variable_key),
                    UNIQUE (draft_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS draft_history_active (
                    id TEXT PRIMARY KEY,
                    draft_id TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    opening TEXT NOT NULL,
                    body TEXT NOT NULL,
                    closing TEXT NOT NULL,
                    template_id TEXT REFERENCES templates (id) ON DELETE SET NULL,
                    signature_id TEXT REFERENCES signatures (id) ON DELETE SET NULL,
                    recorded_at TEXT NOT NULL,
                    sort_order INTEGER NOT NULL UNIQUE
                );

                CREATE TABLE IF NOT EXISTS draft_history_active_values (
                    history_id TEXT NOT NULL REFERENCES draft_history_active (id) ON DELETE CASCADE,
                    variable_key TEXT NOT NULL,
                    variable_value TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (history_id, variable_key),
                    UNIQUE (history_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS draft_history_trashed (
                    id TEXT PRIMARY KEY,
                    draft_id TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    opening TEXT NOT NULL,
                    body TEXT NOT NULL,
                    closing TEXT NOT NULL,
                    template_id TEXT REFERENCES templates (id) ON DELETE SET NULL,
                    signature_id TEXT REFERENCES signatures (id) ON DELETE SET NULL,
                    recorded_at TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    UNIQUE (draft_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS draft_history_trashed_values (
                    history_id TEXT NOT NULL REFERENCES draft_history_trashed (id) ON DELETE CASCADE,
                    variable_key TEXT NOT NULL,
                    variable_value TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (history_id, variable_key),
                    UNIQUE (history_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS memos (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1)),
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    in_trash INTEGER NOT NULL CHECK (in_trash IN (0, 1)),
                    deleted_at TEXT,
                    sort_order INTEGER NOT NULL,
                    CHECK (
                        (in_trash = 0 AND deleted_at IS NULL)
                        OR (in_trash = 1 AND deleted_at IS NOT NULL)
                    ),
                    UNIQUE (in_trash, sort_order)
                );

                CREATE TABLE IF NOT EXISTS variable_presets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    sort_order INTEGER NOT NULL UNIQUE
                );

                CREATE TABLE IF NOT EXISTS variable_preset_values (
                    preset_id TEXT NOT NULL REFERENCES variable_presets (id) ON DELETE CASCADE,
                    variable_key TEXT NOT NULL,
                    variable_value TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (preset_id, variable_key),
                    UNIQUE (preset_id, sort_order)
                );

                CREATE TRIGGER IF NOT EXISTS trg_active_history_requires_active_draft
                BEFORE INSERT ON draft_history_active
                FOR EACH ROW
                WHEN (SELECT in_trash FROM drafts WHERE id = NEW.draft_id) != 0
                BEGIN
                    SELECT RAISE(ABORT, 'active_history_requires_active_draft');
                END;

                CREATE TRIGGER IF NOT EXISTS trg_trashed_history_requires_trashed_draft
                BEFORE INSERT ON draft_history_trashed
                FOR EACH ROW
                WHEN (SELECT in_trash FROM drafts WHERE id = NEW.draft_id) != 1
                BEGIN
                    SELECT RAISE(ABORT, 'trashed_history_requires_trashed_draft');
                END;
                "#,
            )
            .map_err(|error| error.to_string())?;
        connection
            .pragma_update(None, "user_version", SQLITE_SCHEMA_VERSION)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn settings_initialized(connection: &Connection) -> Result<bool, String> {
    initialization_flag(connection, "settings_initialized")
}

fn store_initialized(connection: &Connection) -> Result<bool, String> {
    initialization_flag(connection, "store_initialized")
}

fn initialization_flag(connection: &Connection, column: &str) -> Result<bool, String> {
    let sql = format!("SELECT {column} FROM persistence_state WHERE id = 1");
    let value = connection
        .query_row(&sql, [], |row| row.get::<_, i64>(0))
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or(0);
    Ok(decode_bool(value))
}

fn set_initialization_flags(
    transaction: &Transaction<'_>,
    store_initialized: Option<bool>,
    settings_initialized: Option<bool>,
) -> Result<(), String> {
    if let Some(store_initialized) = store_initialized {
        transaction
            .execute(
                "UPDATE persistence_state SET store_initialized = ?1 WHERE id = 1",
                [encode_bool(store_initialized)],
            )
            .map_err(|error| error.to_string())?;
    }

    if let Some(settings_initialized) = settings_initialized {
        transaction
            .execute(
                "UPDATE persistence_state SET settings_initialized = ?1 WHERE id = 1",
                [encode_bool(settings_initialized)],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn load_settings(connection: &Connection) -> Result<AppSettings, String> {
    let logging = connection
        .query_row(
            "SELECT mode, retention_days FROM settings_logging WHERE id = 1",
            [],
            |row| {
                Ok(LoggingSettings {
                    mode: decode_logging_mode(&row.get::<_, String>(0)?)?,
                    retention_days: row.get::<_, u16>(1)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or_default();

    let mut disabled_rule_ids = Vec::new();
    let mut statement = connection
        .prepare("SELECT rule_id FROM settings_proofreading_disabled_rules ORDER BY sort_order ASC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    for row in rows {
        disabled_rule_ids.push(row.map_err(|error| error.to_string())?);
    }

    Ok(AppSettings {
        logging,
        proofreading: ProofreadingSettings { disabled_rule_ids },
    }
    .normalized())
}

fn clear_settings_tables(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute("DELETE FROM settings_logging", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM settings_proofreading_disabled_rules", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn insert_settings(transaction: &Transaction<'_>, settings: &AppSettings) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO settings_logging (id, mode, retention_days) VALUES (1, ?1, ?2)",
            params![
                settings.logging.mode.as_str(),
                i64::from(settings.logging.retention_days)
            ],
        )
        .map_err(|error| error.to_string())?;

    for (sort_order, rule_id) in settings.proofreading.disabled_rule_ids.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO settings_proofreading_disabled_rules (rule_id, sort_order) VALUES (?1, ?2)",
                params![rule_id, sort_order as i64],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn clear_store_tables(transaction: &Transaction<'_>) -> Result<(), String> {
    for sql in [
        "DELETE FROM draft_history_active_values",
        "DELETE FROM draft_history_trashed_values",
        "DELETE FROM draft_history_active",
        "DELETE FROM draft_history_trashed",
        "DELETE FROM draft_variable_values",
        "DELETE FROM drafts",
        "DELETE FROM variable_preset_values",
        "DELETE FROM variable_presets",
        "DELETE FROM memos",
        "DELETE FROM templates",
        "DELETE FROM signatures",
    ] {
        transaction
            .execute(sql, [])
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn insert_store_snapshot(
    transaction: &Transaction<'_>,
    snapshot: &StoreSnapshot,
) -> Result<(), String> {
    for (sort_order, signature) in snapshot.signatures.iter().enumerate() {
        insert_signature(transaction, signature, false, None, sort_order)?;
    }
    for (sort_order, trashed_signature) in snapshot.trash.signatures.iter().enumerate() {
        insert_signature(
            transaction,
            &trashed_signature.signature,
            true,
            Some(&trashed_signature.deleted_at),
            sort_order,
        )?;
    }

    for (sort_order, template) in snapshot.templates.iter().enumerate() {
        insert_template(transaction, template, false, None, sort_order)?;
    }
    for (sort_order, trashed_template) in snapshot.trash.templates.iter().enumerate() {
        insert_template(
            transaction,
            &trashed_template.template,
            true,
            Some(&trashed_template.deleted_at),
            sort_order,
        )?;
    }

    for (sort_order, memo) in snapshot.memos.iter().enumerate() {
        insert_memo(transaction, memo, false, None, sort_order)?;
    }
    for (sort_order, trashed_memo) in snapshot.trash.memos.iter().enumerate() {
        insert_memo(
            transaction,
            &trashed_memo.memo,
            true,
            Some(&trashed_memo.deleted_at),
            sort_order,
        )?;
    }

    for (sort_order, preset) in snapshot.variable_presets.iter().enumerate() {
        insert_variable_preset(transaction, preset, sort_order)?;
    }

    for (sort_order, draft) in snapshot.drafts.iter().enumerate() {
        insert_draft(transaction, draft, false, None, sort_order)?;
    }
    for (sort_order, trashed_draft) in snapshot.trash.drafts.iter().enumerate() {
        insert_draft(
            transaction,
            &trashed_draft.draft,
            true,
            Some(&trashed_draft.deleted_at),
            sort_order,
        )?;
    }

    for (sort_order, entry) in snapshot.draft_history.iter().enumerate() {
        insert_draft_history_active(transaction, entry, sort_order)?;
    }

    for trashed_draft in &snapshot.trash.drafts {
        for (sort_order, entry) in trashed_draft.history.iter().enumerate() {
            insert_draft_history_trashed(transaction, entry, sort_order)?;
        }
    }

    Ok(())
}

fn insert_signature(
    transaction: &Transaction<'_>,
    signature: &Signature,
    in_trash: bool,
    deleted_at: Option<&str>,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO signatures (
                id, name, is_pinned, body, is_default, created_at, updated_at, in_trash,
                deleted_at, sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                &signature.id,
                &signature.name,
                encode_bool(signature.is_pinned),
                &signature.body,
                encode_bool(signature.is_default),
                &signature.created_at,
                &signature.updated_at,
                encode_bool(in_trash),
                deleted_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn insert_template(
    transaction: &Transaction<'_>,
    template: &Template,
    in_trash: bool,
    deleted_at: Option<&str>,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO templates (
                id, name, is_pinned, subject, recipient, opening, body, closing, signature_id,
                created_at, updated_at, in_trash, deleted_at, sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            "#,
            params![
                &template.id,
                &template.name,
                encode_bool(template.is_pinned),
                &template.subject,
                &template.recipient,
                &template.opening,
                &template.body,
                &template.closing,
                &template.signature_id,
                &template.created_at,
                &template.updated_at,
                encode_bool(in_trash),
                deleted_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn insert_memo(
    transaction: &Transaction<'_>,
    memo: &Memo,
    in_trash: bool,
    deleted_at: Option<&str>,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO memos (
                id, title, is_pinned, body, created_at, updated_at, in_trash, deleted_at,
                sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                &memo.id,
                &memo.title,
                encode_bool(memo.is_pinned),
                &memo.body,
                &memo.created_at,
                &memo.updated_at,
                encode_bool(in_trash),
                deleted_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn insert_variable_preset(
    transaction: &Transaction<'_>,
    preset: &VariablePreset,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO variable_presets (id, name, created_at, updated_at, sort_order)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                &preset.id,
                &preset.name,
                &preset.created_at,
                &preset.updated_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    insert_variable_pairs(
        transaction,
        "variable_preset_values",
        "preset_id",
        &preset.id,
        &preset.values,
    )
}

fn insert_draft(
    transaction: &Transaction<'_>,
    draft: &Draft,
    in_trash: bool,
    deleted_at: Option<&str>,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO drafts (
                id, title, is_pinned, subject, recipient, opening, body, closing, template_id,
                signature_id, created_at, updated_at, in_trash, deleted_at, sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                &draft.id,
                &draft.title,
                encode_bool(draft.is_pinned),
                &draft.subject,
                &draft.recipient,
                &draft.opening,
                &draft.body,
                &draft.closing,
                &draft.template_id,
                &draft.signature_id,
                &draft.created_at,
                &draft.updated_at,
                encode_bool(in_trash),
                deleted_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    insert_variable_pairs(
        transaction,
        "draft_variable_values",
        "draft_id",
        &draft.id,
        &draft.variable_values,
    )
}

fn insert_draft_history_active(
    transaction: &Transaction<'_>,
    entry: &DraftHistoryEntry,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO draft_history_active (
                id, draft_id, title, subject, recipient, opening, body, closing, template_id,
                signature_id, recorded_at, sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                &entry.id,
                &entry.draft_id,
                &entry.title,
                &entry.subject,
                &entry.recipient,
                &entry.opening,
                &entry.body,
                &entry.closing,
                &entry.template_id,
                &entry.signature_id,
                &entry.recorded_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    insert_variable_pairs(
        transaction,
        "draft_history_active_values",
        "history_id",
        &entry.id,
        &entry.variable_values,
    )
}

fn insert_draft_history_trashed(
    transaction: &Transaction<'_>,
    entry: &DraftHistoryEntry,
    sort_order: usize,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO draft_history_trashed (
                id, draft_id, title, subject, recipient, opening, body, closing, template_id,
                signature_id, recorded_at, sort_order
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                &entry.id,
                &entry.draft_id,
                &entry.title,
                &entry.subject,
                &entry.recipient,
                &entry.opening,
                &entry.body,
                &entry.closing,
                &entry.template_id,
                &entry.signature_id,
                &entry.recorded_at,
                sort_order as i64
            ],
        )
        .map_err(|error| error.to_string())?;

    insert_variable_pairs(
        transaction,
        "draft_history_trashed_values",
        "history_id",
        &entry.id,
        &entry.variable_values,
    )
}

fn insert_variable_pairs(
    transaction: &Transaction<'_>,
    table: &str,
    owner_column: &str,
    owner_id: &str,
    values: &BTreeMap<String, String>,
) -> Result<(), String> {
    let sql = format!(
        "INSERT INTO {table} ({owner_column}, variable_key, variable_value, sort_order) VALUES (?1, ?2, ?3, ?4)"
    );
    for (sort_order, (key, value)) in values.iter().enumerate() {
        transaction
            .execute(&sql, params![owner_id, key, value, sort_order as i64])
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn load_store_snapshot(connection: &Connection) -> Result<StoreSnapshot, String> {
    let signatures = load_signatures(connection, false)?;
    let trashed_signatures = load_trashed_signatures(connection)?;
    let templates = load_templates(connection, false)?;
    let trashed_templates = load_trashed_templates(connection)?;
    let memos = load_memos(connection, false)?;
    let trashed_memos = load_trashed_memos(connection)?;
    let variable_presets = load_variable_presets(connection)?;
    let drafts = load_drafts(connection, false)?;
    let trashed_drafts = load_trashed_drafts(connection)?;
    let draft_history = load_draft_history_active(connection)?;

    Ok(StoreSnapshot {
        drafts,
        draft_history,
        variable_presets,
        templates,
        signatures,
        memos,
        legacy_memo: None,
        trash: TrashSnapshot {
            drafts: trashed_drafts,
            templates: trashed_templates,
            signatures: trashed_signatures,
            memos: trashed_memos,
        },
    })
}

fn load_signatures(connection: &Connection, in_trash: bool) -> Result<Vec<Signature>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, is_pinned, body, is_default, created_at, updated_at
            FROM signatures
            WHERE in_trash = ?1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([encode_bool(in_trash)], |row| {
            Ok(Signature {
                id: row.get(0)?,
                name: row.get(1)?,
                is_pinned: decode_bool(row.get::<_, i64>(2)?),
                body: row.get(3)?,
                is_default: decode_bool(row.get::<_, i64>(4)?),
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut signatures = Vec::new();
    for row in rows {
        signatures.push(row.map_err(|error| error.to_string())?);
    }

    Ok(signatures)
}

fn load_trashed_signatures(connection: &Connection) -> Result<Vec<TrashedSignature>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, is_pinned, body, is_default, created_at, updated_at, deleted_at
            FROM signatures
            WHERE in_trash = 1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(TrashedSignature {
                signature: Signature {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    is_pinned: decode_bool(row.get::<_, i64>(2)?),
                    body: row.get(3)?,
                    is_default: decode_bool(row.get::<_, i64>(4)?),
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                },
                deleted_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut signatures = Vec::new();
    for row in rows {
        signatures.push(row.map_err(|error| error.to_string())?);
    }

    Ok(signatures)
}

fn load_templates(connection: &Connection, in_trash: bool) -> Result<Vec<Template>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, is_pinned, subject, recipient, opening, body, closing,
                   signature_id, created_at, updated_at
            FROM templates
            WHERE in_trash = ?1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([encode_bool(in_trash)], |row| {
            Ok(Template {
                id: row.get(0)?,
                name: row.get(1)?,
                is_pinned: decode_bool(row.get::<_, i64>(2)?),
                subject: row.get(3)?,
                recipient: row.get(4)?,
                opening: row.get(5)?,
                body: row.get(6)?,
                closing: row.get(7)?,
                signature_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|error| error.to_string())?);
    }

    Ok(templates)
}

fn load_trashed_templates(connection: &Connection) -> Result<Vec<TrashedTemplate>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, is_pinned, subject, recipient, opening, body, closing,
                   signature_id, created_at, updated_at, deleted_at
            FROM templates
            WHERE in_trash = 1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(TrashedTemplate {
                template: Template {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    is_pinned: decode_bool(row.get::<_, i64>(2)?),
                    subject: row.get(3)?,
                    recipient: row.get(4)?,
                    opening: row.get(5)?,
                    body: row.get(6)?,
                    closing: row.get(7)?,
                    signature_id: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                },
                deleted_at: row.get(11)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|error| error.to_string())?);
    }

    Ok(templates)
}

fn load_memos(connection: &Connection, in_trash: bool) -> Result<Vec<Memo>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, title, is_pinned, body, created_at, updated_at
            FROM memos
            WHERE in_trash = ?1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([encode_bool(in_trash)], |row| {
            Ok(Memo {
                id: row.get(0)?,
                title: row.get(1)?,
                is_pinned: decode_bool(row.get::<_, i64>(2)?),
                body: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(row.map_err(|error| error.to_string())?);
    }

    Ok(memos)
}

fn load_trashed_memos(connection: &Connection) -> Result<Vec<TrashedMemo>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, title, is_pinned, body, created_at, updated_at, deleted_at
            FROM memos
            WHERE in_trash = 1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(TrashedMemo {
                memo: Memo {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    is_pinned: decode_bool(row.get::<_, i64>(2)?),
                    body: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                },
                deleted_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut memos = Vec::new();
    for row in rows {
        memos.push(row.map_err(|error| error.to_string())?);
    }

    Ok(memos)
}

fn load_variable_presets(connection: &Connection) -> Result<Vec<VariablePreset>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, created_at, updated_at
            FROM variable_presets
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(VariablePreset {
                id: row.get(0)?,
                name: row.get(1)?,
                values: BTreeMap::new(),
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut presets = Vec::new();
    for row in rows {
        let mut preset = row.map_err(|error| error.to_string())?;
        preset.values = load_variable_pairs(
            connection,
            "variable_preset_values",
            "preset_id",
            &preset.id,
        )?;
        presets.push(preset);
    }

    Ok(presets)
}

fn load_drafts(connection: &Connection, in_trash: bool) -> Result<Vec<Draft>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, title, is_pinned, subject, recipient, opening, body, closing, template_id,
                   signature_id, created_at, updated_at
            FROM drafts
            WHERE in_trash = ?1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([encode_bool(in_trash)], |row| {
            Ok(Draft {
                id: row.get(0)?,
                title: row.get(1)?,
                is_pinned: decode_bool(row.get::<_, i64>(2)?),
                subject: row.get(3)?,
                recipient: row.get(4)?,
                opening: row.get(5)?,
                body: row.get(6)?,
                closing: row.get(7)?,
                template_id: row.get(8)?,
                signature_id: row.get(9)?,
                variable_values: BTreeMap::new(),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut drafts = Vec::new();
    for row in rows {
        let mut draft = row.map_err(|error| error.to_string())?;
        draft.variable_values =
            load_variable_pairs(connection, "draft_variable_values", "draft_id", &draft.id)?;
        drafts.push(draft);
    }

    Ok(drafts)
}

fn load_trashed_drafts(connection: &Connection) -> Result<Vec<TrashedDraft>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, title, is_pinned, subject, recipient, opening, body, closing, template_id,
                   signature_id, created_at, updated_at, deleted_at
            FROM drafts
            WHERE in_trash = 1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                Draft {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    is_pinned: decode_bool(row.get::<_, i64>(2)?),
                    subject: row.get(3)?,
                    recipient: row.get(4)?,
                    opening: row.get(5)?,
                    body: row.get(6)?,
                    closing: row.get(7)?,
                    template_id: row.get(8)?,
                    signature_id: row.get(9)?,
                    variable_values: BTreeMap::new(),
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                },
                row.get::<_, String>(12)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut drafts = Vec::new();
    for row in rows {
        let (mut draft, deleted_at) = row.map_err(|error| error.to_string())?;
        let draft_id = draft.id.clone();
        draft.variable_values =
            load_variable_pairs(connection, "draft_variable_values", "draft_id", &draft_id)?;
        drafts.push(TrashedDraft {
            history: load_draft_history_trashed(connection, &draft_id)?,
            draft,
            deleted_at,
        });
    }

    Ok(drafts)
}

fn load_draft_history_active(connection: &Connection) -> Result<Vec<DraftHistoryEntry>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, draft_id, title, subject, recipient, opening, body, closing, template_id,
                   signature_id, recorded_at
            FROM draft_history_active
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(DraftHistoryEntry {
                id: row.get(0)?,
                draft_id: row.get(1)?,
                title: row.get(2)?,
                subject: row.get(3)?,
                recipient: row.get(4)?,
                opening: row.get(5)?,
                body: row.get(6)?,
                closing: row.get(7)?,
                template_id: row.get(8)?,
                signature_id: row.get(9)?,
                variable_values: BTreeMap::new(),
                recorded_at: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut entries = Vec::new();
    for row in rows {
        let mut entry = row.map_err(|error| error.to_string())?;
        entry.variable_values = load_variable_pairs(
            connection,
            "draft_history_active_values",
            "history_id",
            &entry.id,
        )?;
        entries.push(entry);
    }

    Ok(entries)
}

fn load_draft_history_trashed(
    connection: &Connection,
    draft_id: &str,
) -> Result<Vec<DraftHistoryEntry>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, draft_id, title, subject, recipient, opening, body, closing, template_id,
                   signature_id, recorded_at
            FROM draft_history_trashed
            WHERE draft_id = ?1
            ORDER BY sort_order ASC
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([draft_id], |row| {
            Ok(DraftHistoryEntry {
                id: row.get(0)?,
                draft_id: row.get(1)?,
                title: row.get(2)?,
                subject: row.get(3)?,
                recipient: row.get(4)?,
                opening: row.get(5)?,
                body: row.get(6)?,
                closing: row.get(7)?,
                template_id: row.get(8)?,
                signature_id: row.get(9)?,
                variable_values: BTreeMap::new(),
                recorded_at: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut entries = Vec::new();
    for row in rows {
        let mut entry = row.map_err(|error| error.to_string())?;
        entry.variable_values = load_variable_pairs(
            connection,
            "draft_history_trashed_values",
            "history_id",
            &entry.id,
        )?;
        entries.push(entry);
    }

    Ok(entries)
}

fn load_variable_pairs(
    connection: &Connection,
    table: &str,
    owner_column: &str,
    owner_id: &str,
) -> Result<BTreeMap<String, String>, String> {
    let sql = format!(
        "SELECT variable_key, variable_value FROM {table} WHERE {owner_column} = ?1 ORDER BY sort_order ASC"
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([owner_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;

    let mut values = BTreeMap::new();
    for row in rows {
        let (key, value) = row.map_err(|error| error.to_string())?;
        values.insert(key, value);
    }

    Ok(values)
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

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use tempfile::tempdir;

    use super::{load_store_snapshot, settings_initialized, store_initialized, SqliteRepository};
    use crate::{
        app::{
            persistence::PersistenceRepository,
            settings::{AppSettings, LoggingMode, LoggingSettings, ProofreadingSettings},
        },
        modules::{store::StoreSnapshot, trash::TrashedDraft},
    };

    #[test]
    fn sqlite_repository_round_trips_store_and_settings() {
        let directory = tempdir().expect("tempdir");
        let db_path = directory.path().join("maildraft.sqlite3");
        let repository = SqliteRepository::new(db_path);

        let mut snapshot = StoreSnapshot::seeded();
        snapshot.templates[0].signature_id = snapshot
            .trash
            .signatures
            .first()
            .map(|entry| entry.signature.id.clone());
        snapshot.trash.drafts.push(TrashedDraft {
            draft: snapshot.drafts[0].clone(),
            history: snapshot.draft_history.clone(),
            deleted_at: "999".to_string(),
        });
        snapshot.drafts.retain(|draft| draft.id != "draft-welcome");
        snapshot.draft_history.clear();
        snapshot.ensure_consistency();

        let settings = AppSettings {
            logging: LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 30,
            },
            proofreading: ProofreadingSettings {
                disabled_rule_ids: vec!["prh".to_string(), "whitespace.trailing".to_string()],
            },
        };

        repository
            .save_store_snapshot(&snapshot)
            .expect("save store snapshot");
        repository
            .save_app_settings(&settings)
            .expect("save settings");

        let loaded_store = repository
            .load_store_snapshot()
            .expect("load store snapshot")
            .value;
        let loaded_settings = repository.load_app_settings().expect("load settings").value;

        assert_eq!(
            serde_json::to_value(&loaded_store).expect("serialize loaded store"),
            serde_json::to_value(&snapshot).expect("serialize original store"),
        );
        assert_eq!(
            serde_json::to_value(&loaded_settings).expect("serialize loaded settings"),
            serde_json::to_value(settings.normalized()).expect("serialize original settings"),
        );
    }

    #[test]
    fn sqlite_repository_initializes_schema_only_once() {
        let directory = tempdir().expect("tempdir");
        let db_path = directory.path().join("maildraft.sqlite3");
        let repository = SqliteRepository::new(db_path);

        let connection = repository
            .open_connection_for_tests()
            .expect("open connection");
        let version = connection
            .pragma_query_value(None, "user_version", |row| row.get::<_, i32>(0))
            .expect("query user version");
        assert_eq!(version, 1);
        assert!(!store_initialized(&connection).expect("store initialized"));
        assert!(!settings_initialized(&connection).expect("settings initialized"));

        drop(connection);
        repository
            .open_connection_for_tests()
            .expect("reopen connection after migrations");
    }

    #[test]
    fn sqlite_schema_enforces_unique_active_default_signature_and_history_scope() {
        let directory = tempdir().expect("tempdir");
        let db_path = directory.path().join("maildraft.sqlite3");
        let repository = SqliteRepository::new(db_path);
        let connection = repository
            .open_connection_for_tests()
            .expect("open connection");

        connection
            .execute(
                r#"
                INSERT INTO signatures (
                    id, name, is_pinned, body, is_default, created_at, updated_at, in_trash,
                    deleted_at, sort_order
                ) VALUES ('sig-1', '標準', 0, 'body', 1, '1', '1', 0, NULL, 0)
                "#,
                [],
            )
            .expect("insert first default signature");
        let signature_error = connection
            .execute(
                r#"
                INSERT INTO signatures (
                    id, name, is_pinned, body, is_default, created_at, updated_at, in_trash,
                    deleted_at, sort_order
                ) VALUES ('sig-2', '営業', 0, 'body', 1, '1', '1', 0, NULL, 1)
                "#,
                [],
            )
            .unwrap_err()
            .to_string();
        assert!(signature_error.contains("UNIQUE"));

        connection
            .execute(
                r#"
                INSERT INTO drafts (
                    id, title, is_pinned, subject, recipient, opening, body, closing, template_id,
                    signature_id, created_at, updated_at, in_trash, deleted_at, sort_order
                ) VALUES ('draft-1', '下書き', 0, '', '', '', '', '', NULL, NULL, '1', '1', 0, NULL, 0)
                "#,
                [],
            )
            .expect("insert active draft");
        let history_error = connection
            .execute(
                r#"
                INSERT INTO draft_history_trashed (
                    id, draft_id, title, subject, recipient, opening, body, closing, template_id,
                    signature_id, recorded_at, sort_order
                ) VALUES ('history-1', 'draft-1', '履歴', '', '', '', '', '', NULL, NULL, '1', 0)
                "#,
                [],
            )
            .unwrap_err()
            .to_string();
        assert!(history_error.contains("trashed_history_requires_trashed_draft"));
    }

    #[test]
    fn sqlite_repository_loads_seed_defaults_when_database_has_no_saved_state() {
        let directory = tempdir().expect("tempdir");
        let db_path = directory.path().join("maildraft.sqlite3");
        let repository = SqliteRepository::new(db_path);

        let store = repository
            .load_store_snapshot()
            .expect("load default store")
            .value;
        let settings = repository
            .load_app_settings()
            .expect("load default settings")
            .value;

        assert_eq!(
            serde_json::to_value(store).expect("serialize store"),
            serde_json::to_value(StoreSnapshot::seeded()).expect("serialize seeded store"),
        );
        assert_eq!(settings.logging.mode, LoggingMode::ErrorsOnly);
        assert_eq!(settings.logging.retention_days, 14);
        assert!(settings.proofreading.disabled_rule_ids.is_empty());
    }

    #[test]
    fn sqlite_load_helpers_reconstruct_snapshot_from_raw_tables() {
        let directory = tempdir().expect("tempdir");
        let db_path = directory.path().join("maildraft.sqlite3");
        let repository = SqliteRepository::new(db_path);
        let mut connection = repository
            .open_connection_for_tests()
            .expect("open connection");
        let transaction = connection.transaction().expect("transaction");
        let snapshot = StoreSnapshot::seeded();
        super::insert_store_snapshot(&transaction, &snapshot).expect("insert snapshot");
        super::set_initialization_flags(&transaction, Some(true), None).expect("mark initialized");
        transaction.commit().expect("commit");

        let loaded = load_store_snapshot(&connection).expect("load raw snapshot");
        assert_eq!(
            serde_json::to_value(&loaded).expect("serialize loaded"),
            serde_json::to_value(&snapshot).expect("serialize snapshot"),
        );
    }
}

use rusqlite::Connection;

pub(super) const SQLITE_SCHEMA_VERSION: i32 = 5;

pub(super) fn apply_migrations(connection: &Connection) -> Result<(), String> {
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
    }

    if current_version < 2 {
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS settings_editor (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    indent_style TEXT NOT NULL CHECK (indent_style IN ('spaces', 'tabs')),
                    tab_size INTEGER NOT NULL CHECK (tab_size BETWEEN 1 AND 8)
                );
                "#,
            )
            .map_err(|error| error.to_string())?;
    }

    if current_version < 3 {
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS draft_tags (
                    draft_id TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (draft_id, tag),
                    UNIQUE (draft_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS draft_history_active_tags (
                    history_id TEXT NOT NULL REFERENCES draft_history_active (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (history_id, tag),
                    UNIQUE (history_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS draft_history_trashed_tags (
                    history_id TEXT NOT NULL REFERENCES draft_history_trashed (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (history_id, tag),
                    UNIQUE (history_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS template_tags (
                    template_id TEXT NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (template_id, tag),
                    UNIQUE (template_id, sort_order)
                );

                CREATE TABLE IF NOT EXISTS memo_tags (
                    memo_id TEXT NOT NULL REFERENCES memos (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (memo_id, tag),
                    UNIQUE (memo_id, sort_order)
                );
                "#,
            )
            .map_err(|error| error.to_string())?;
    }

    if current_version < 4 {
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS blocks (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL CHECK (
                        category IN ('greeting', 'request', 'thanks', 'reminder', 'decline', 'other')
                    ),
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

                CREATE TABLE IF NOT EXISTS block_tags (
                    block_id TEXT NOT NULL REFERENCES blocks (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (block_id, tag),
                    UNIQUE (block_id, sort_order)
                );
                "#,
            )
            .map_err(|error| error.to_string())?;
    }

    if current_version < 5 {
        connection
            .execute_batch(
                r#"
                ALTER TABLE variable_presets ADD COLUMN last_used_at TEXT;

                CREATE TABLE IF NOT EXISTS variable_preset_tags (
                    preset_id TEXT NOT NULL REFERENCES variable_presets (id) ON DELETE CASCADE,
                    tag TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    PRIMARY KEY (preset_id, tag),
                    UNIQUE (preset_id, sort_order)
                );
                "#,
            )
            .map_err(|error| error.to_string())?;
    }

    connection
        .pragma_update(None, "user_version", SQLITE_SCHEMA_VERSION)
        .map_err(|error| error.to_string())?;

    Ok(())
}

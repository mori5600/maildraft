use std::collections::BTreeMap;

use rusqlite::{Connection, OptionalExtension};

use crate::{
    app::settings::{AppSettings, EditorIndentStyle, EditorSettings, LoggingSettings, ProofreadingSettings},
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

pub(super) fn load_settings(connection: &Connection) -> Result<AppSettings, String> {
    let logging = connection
        .query_row(
            "SELECT mode, retention_days FROM settings_logging WHERE id = 1",
            [],
            |row| {
                Ok(LoggingSettings {
                    mode: super::decode_logging_mode(&row.get::<_, String>(0)?)?,
                    retention_days: row.get::<_, u16>(1)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or_default();

    let editor = connection
        .query_row(
            "SELECT indent_style, tab_size FROM settings_editor WHERE id = 1",
            [],
            |row| {
                Ok(EditorSettings {
                    indent_style: match row.get::<_, String>(0)?.as_str() {
                        "tabs" => EditorIndentStyle::Tabs,
                        _ => EditorIndentStyle::Spaces,
                    },
                    tab_size: row.get::<_, u8>(1)?,
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
        editor,
        proofreading: ProofreadingSettings { disabled_rule_ids },
    }
    .normalized())
}

pub(super) fn load_store_snapshot(connection: &Connection) -> Result<StoreSnapshot, String> {
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
        .query_map([super::encode_bool(in_trash)], |row| {
            Ok(Signature {
                id: row.get(0)?,
                name: row.get(1)?,
                is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
                body: row.get(3)?,
                is_default: super::decode_bool(row.get::<_, i64>(4)?),
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
                    is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
                    body: row.get(3)?,
                    is_default: super::decode_bool(row.get::<_, i64>(4)?),
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
        .query_map([super::encode_bool(in_trash)], |row| {
            Ok(Template {
                id: row.get(0)?,
                name: row.get(1)?,
                is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
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
                    is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
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
        .query_map([super::encode_bool(in_trash)], |row| {
            Ok(Memo {
                id: row.get(0)?,
                title: row.get(1)?,
                is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
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
                    is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
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
        .query_map([super::encode_bool(in_trash)], |row| {
            Ok(Draft {
                id: row.get(0)?,
                title: row.get(1)?,
                is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
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
                    is_pinned: super::decode_bool(row.get::<_, i64>(2)?),
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

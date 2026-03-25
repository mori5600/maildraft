use std::collections::BTreeMap;

use rusqlite::{params, Transaction};

use crate::{
    app::settings::AppSettings,
    modules::{
        drafts::{Draft, DraftHistoryEntry},
        memo::Memo,
        signatures::Signature,
        store::StoreSnapshot,
        templates::Template,
        variable_presets::VariablePreset,
    },
};

pub(super) fn set_initialization_flags(
    transaction: &Transaction<'_>,
    store_initialized: Option<bool>,
    settings_initialized: Option<bool>,
) -> Result<(), String> {
    if let Some(store_initialized) = store_initialized {
        transaction
            .execute(
                "UPDATE persistence_state SET store_initialized = ?1 WHERE id = 1",
                [super::encode_bool(store_initialized)],
            )
            .map_err(|error| error.to_string())?;
    }

    if let Some(settings_initialized) = settings_initialized {
        transaction
            .execute(
                "UPDATE persistence_state SET settings_initialized = ?1 WHERE id = 1",
                [super::encode_bool(settings_initialized)],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub(super) fn clear_settings_tables(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute("DELETE FROM settings_logging", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM settings_proofreading_disabled_rules", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(super) fn insert_settings(
    transaction: &Transaction<'_>,
    settings: &AppSettings,
) -> Result<(), String> {
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

pub(super) fn clear_store_tables(transaction: &Transaction<'_>) -> Result<(), String> {
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

pub(super) fn insert_store_snapshot(
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
                super::encode_bool(signature.is_pinned),
                &signature.body,
                super::encode_bool(signature.is_default),
                &signature.created_at,
                &signature.updated_at,
                super::encode_bool(in_trash),
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
                super::encode_bool(template.is_pinned),
                &template.subject,
                &template.recipient,
                &template.opening,
                &template.body,
                &template.closing,
                &template.signature_id,
                &template.created_at,
                &template.updated_at,
                super::encode_bool(in_trash),
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
                super::encode_bool(memo.is_pinned),
                &memo.body,
                &memo.created_at,
                &memo.updated_at,
                super::encode_bool(in_trash),
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
                super::encode_bool(draft.is_pinned),
                &draft.subject,
                &draft.recipient,
                &draft.opening,
                &draft.body,
                &draft.closing,
                &draft.template_id,
                &draft.signature_id,
                &draft.created_at,
                &draft.updated_at,
                super::encode_bool(in_trash),
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

use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Map, Value};

use crate::app::settings::{EditorSettings, LoggingSettings, ProofreadingSettings};
use crate::modules::{
    drafts::DraftInput, memo::MemoInput, signatures::SignatureInput, store::StoreSnapshot,
    templates::TemplateInput, variable_presets::VariablePresetInput,
};

pub(super) fn timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    duration.as_secs().to_string()
}

pub(super) fn elapsed_millis(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis() as u64
}

pub(super) fn snapshot_counts_context(snapshot: &StoreSnapshot) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("draft_count".to_string(), json!(snapshot.drafts.len()));
    context.insert(
        "variable_preset_count".to_string(),
        json!(snapshot.variable_presets.len()),
    );
    context.insert(
        "template_count".to_string(),
        json!(snapshot.templates.len()),
    );
    context.insert(
        "signature_count".to_string(),
        json!(snapshot.signatures.len()),
    );
    context.insert("memo_count".to_string(), json!(snapshot.memos.len()));
    context.insert(
        "trash_count".to_string(),
        json!(snapshot.trash.item_count()),
    );
    context
}

pub(super) fn trash_kind_context(kind: &str) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("kind".to_string(), json!(kind));
    context
}

pub(super) fn draft_context(input: &DraftInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "has_template".to_string(),
        json!(input.template_id.is_some()),
    );
    context.insert(
        "has_signature".to_string(),
        json!(input.signature_id.is_some()),
    );
    context.insert(
        "title_length".to_string(),
        json!(input.title.chars().count()),
    );
    context.insert("is_pinned".to_string(), json!(input.is_pinned));
    context.insert(
        "subject_length".to_string(),
        json!(input.subject.chars().count()),
    );
    context.insert(
        "recipient_length".to_string(),
        json!(input.recipient.chars().count()),
    );
    context.insert(
        "opening_length".to_string(),
        json!(input.opening.chars().count()),
    );
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert(
        "closing_length".to_string(),
        json!(input.closing.chars().count()),
    );
    context.insert(
        "variable_count".to_string(),
        json!(input.variable_values.len()),
    );
    context.insert("tag_count".to_string(), json!(input.tags.len()));
    context
}

pub(super) fn template_context(input: &TemplateInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "has_signature".to_string(),
        json!(input.signature_id.is_some()),
    );
    context.insert("is_pinned".to_string(), json!(input.is_pinned));
    context.insert("name_length".to_string(), json!(input.name.chars().count()));
    context.insert(
        "subject_length".to_string(),
        json!(input.subject.chars().count()),
    );
    context.insert(
        "recipient_length".to_string(),
        json!(input.recipient.chars().count()),
    );
    context.insert(
        "opening_length".to_string(),
        json!(input.opening.chars().count()),
    );
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert(
        "closing_length".to_string(),
        json!(input.closing.chars().count()),
    );
    context.insert("tag_count".to_string(), json!(input.tags.len()));
    context
}

pub(super) fn variable_preset_context(input: &VariablePresetInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("name_length".to_string(), json!(input.name.chars().count()));
    context.insert("value_count".to_string(), json!(input.values.len()));
    context
}

pub(super) fn signature_context(input: &SignatureInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("name_length".to_string(), json!(input.name.chars().count()));
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert("is_pinned".to_string(), json!(input.is_pinned));
    context.insert("is_default".to_string(), json!(input.is_default));
    context
}

pub(super) fn memo_context(input: &MemoInput) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "has_title".to_string(),
        json!(!input.title.trim().is_empty()),
    );
    context.insert(
        "title_length".to_string(),
        json!(input.title.chars().count()),
    );
    context.insert("body_length".to_string(), json!(input.body.chars().count()));
    context.insert("tag_count".to_string(), json!(input.tags.len()));
    context
}

pub(super) fn logging_settings_context(settings: &LoggingSettings) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert("retention_days".to_string(), json!(settings.retention_days));
    context.insert("mode".to_string(), json!(settings.mode.as_str()));
    context
}

pub(super) fn proofreading_settings_context(settings: &ProofreadingSettings) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "disabled_rule_count".to_string(),
        json!(settings.disabled_rule_ids.len()),
    );
    context
}

pub(super) fn editor_settings_context(settings: &EditorSettings) -> Map<String, Value> {
    let mut context = Map::new();
    context.insert(
        "indent_style".to_string(),
        json!(settings.indent_style.as_str()),
    );
    context.insert("tab_size".to_string(), json!(settings.tab_size));
    context
}

pub(super) fn merge_context(
    mut left: Map<String, Value>,
    right: Map<String, Value>,
) -> Map<String, Value> {
    left.extend(right);
    left
}

//! Store types shared across storage and Tauri commands.

mod consistency;
mod draft_operations;
mod memo_operations;
mod seed;
mod signature_operations;
mod template_operations;

#[cfg(test)]
mod tests;
mod trash_operations;

use serde::{Deserialize, Serialize};

use crate::modules::{
    drafts::{Draft, DraftHistoryEntry},
    memo::Memo,
    signatures::Signature,
    templates::Template,
    trash::{TrashSnapshot, TrashedDraft, TrashedSignature, TrashedTemplate},
    variable_presets::VariablePreset,
};

const MAX_DRAFT_HISTORY_ENTRIES_PER_DRAFT: usize = 20;
const DRAFT_HISTORY_INTERVAL_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoreSnapshot {
    #[serde(default)]
    pub drafts: Vec<Draft>,
    #[serde(default)]
    pub draft_history: Vec<DraftHistoryEntry>,
    #[serde(default)]
    pub variable_presets: Vec<VariablePreset>,
    #[serde(default)]
    pub templates: Vec<Template>,
    #[serde(default)]
    pub signatures: Vec<Signature>,
    #[serde(default)]
    pub memos: Vec<Memo>,
    #[serde(default, alias = "memo", skip_serializing)]
    pub legacy_memo: Option<Memo>,
    #[serde(default)]
    pub trash: TrashSnapshot,
}

/// Save commands return compact payloads to avoid cloning full snapshots.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDraftResult {
    pub draft: Draft,
    #[serde(default)]
    pub draft_history: Vec<DraftHistoryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDraftResult {
    pub trashed_draft: TrashedDraft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTemplateResult {
    pub template: Template,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTemplateResult {
    pub trashed_template: TrashedTemplate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSignatureResult {
    #[serde(default)]
    pub signatures: Vec<Signature>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablePresetResult {
    #[serde(default)]
    pub variable_presets: Vec<VariablePreset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSignatureResult {
    #[serde(default)]
    pub signatures: Vec<Signature>,
    pub trashed_signature: TrashedSignature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMemoResult {
    #[serde(default)]
    pub memos: Vec<Memo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashMutationResult {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drafts: Option<Vec<Draft>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draft_history: Option<Vec<DraftHistoryEntry>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub templates: Option<Vec<Template>>,
    pub trash: TrashSnapshot,
}

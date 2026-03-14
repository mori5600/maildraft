mod consistency;
mod draft_operations;
mod seed;
mod signature_operations;
mod template_operations;

#[cfg(test)]
mod tests;
mod trash_operations;

use serde::{Deserialize, Serialize};

use crate::modules::{
    drafts::{Draft, DraftHistoryEntry},
    signatures::Signature,
    templates::Template,
    trash::TrashSnapshot,
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
    pub trash: TrashSnapshot,
}

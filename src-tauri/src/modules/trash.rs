use serde::{Deserialize, Serialize};

use crate::modules::{
    drafts::{Draft, DraftHistoryEntry},
    signatures::Signature,
    templates::Template,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrashSnapshot {
    #[serde(default)]
    pub drafts: Vec<TrashedDraft>,
    #[serde(default)]
    pub templates: Vec<TrashedTemplate>,
    #[serde(default)]
    pub signatures: Vec<TrashedSignature>,
}

impl TrashSnapshot {
    pub fn item_count(&self) -> usize {
        self.drafts.len() + self.templates.len() + self.signatures.len()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedDraft {
    pub draft: Draft,
    #[serde(default)]
    pub history: Vec<DraftHistoryEntry>,
    pub deleted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedTemplate {
    pub template: Template,
    pub deleted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedSignature {
    pub signature: Signature,
    pub deleted_at: String,
}

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

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use pretty_assertions::assert_eq;

    use super::{TrashedDraft, TrashedSignature, TrashedTemplate, TrashSnapshot};
    use crate::modules::{
        drafts::Draft,
        signatures::Signature,
        templates::Template,
    };

    #[test]
    fn trash_snapshot_counts_all_item_kinds() {
        let trash = TrashSnapshot {
            drafts: vec![TrashedDraft {
                draft: Draft {
                    id: "draft-1".to_string(),
                    title: "下書き".to_string(),
                    is_pinned: false,
                    subject: "件名".to_string(),
                    recipient: "".to_string(),
                    opening: "".to_string(),
                    body: "".to_string(),
                    closing: "".to_string(),
                    template_id: None,
                    signature_id: None,
                    variable_values: BTreeMap::new(),
                    created_at: "1".to_string(),
                    updated_at: "1".to_string(),
                },
                history: Vec::new(),
                deleted_at: "10".to_string(),
            }],
            templates: vec![TrashedTemplate {
                template: Template {
                    id: "template-1".to_string(),
                    name: "テンプレート".to_string(),
                    is_pinned: false,
                    subject: "".to_string(),
                    recipient: "".to_string(),
                    opening: "".to_string(),
                    body: "".to_string(),
                    closing: "".to_string(),
                    signature_id: None,
                    created_at: "1".to_string(),
                    updated_at: "1".to_string(),
                },
                deleted_at: "11".to_string(),
            }],
            signatures: vec![TrashedSignature {
                signature: Signature {
                    id: "signature-1".to_string(),
                    name: "署名".to_string(),
                    is_pinned: false,
                    body: "".to_string(),
                    is_default: false,
                    created_at: "1".to_string(),
                    updated_at: "1".to_string(),
                },
                deleted_at: "12".to_string(),
            }],
        };

        assert_eq!(trash.item_count(), 3);
    }
}

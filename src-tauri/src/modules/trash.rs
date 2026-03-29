use serde::{Deserialize, Serialize};

use crate::modules::{
    blocks::ContentBlock,
    drafts::{Draft, DraftHistoryEntry},
    memo::Memo,
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
    #[serde(default)]
    pub memos: Vec<TrashedMemo>,
    #[serde(default)]
    pub blocks: Vec<TrashedBlock>,
}

impl TrashSnapshot {
    pub fn item_count(&self) -> usize {
        self.drafts.len()
            + self.templates.len()
            + self.signatures.len()
            + self.memos.len()
            + self.blocks.len()
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedMemo {
    pub memo: Memo,
    pub deleted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedBlock {
    pub block: ContentBlock,
    pub deleted_at: String,
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use pretty_assertions::assert_eq;

    use super::{
        TrashSnapshot, TrashedBlock, TrashedDraft, TrashedMemo, TrashedSignature, TrashedTemplate,
    };
    use crate::modules::{
        blocks::{ContentBlock, ContentBlockCategory},
        drafts::Draft,
        memo::Memo,
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
                    tags: Vec::new(),
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
                    tags: Vec::new(),
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
            memos: vec![TrashedMemo {
                memo: Memo {
                    id: "memo-1".to_string(),
                    title: "メモ".to_string(),
                    is_pinned: false,
                    body: "本文".to_string(),
                    tags: Vec::new(),
                    created_at: "1".to_string(),
                    updated_at: "1".to_string(),
                },
                deleted_at: "13".to_string(),
            }],
            blocks: vec![TrashedBlock {
                block: ContentBlock {
                    id: "block-1".to_string(),
                    name: "挨拶".to_string(),
                    category: ContentBlockCategory::Greeting,
                    body: "いつもお世話になっております。".to_string(),
                    tags: Vec::new(),
                    created_at: "1".to_string(),
                    updated_at: "1".to_string(),
                },
                deleted_at: "14".to_string(),
            }],
        };

        assert_eq!(trash.item_count(), 5);
    }
}

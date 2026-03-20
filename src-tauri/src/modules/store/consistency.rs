use std::collections::HashSet;

use crate::modules::trash::TrashSnapshot;

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn ensure_consistency(&mut self) {
        self.ensure_memos();
        self.ensure_default_signature();
        self.clean_broken_references();
        self.sort_by_recent();
    }

    fn ensure_memos(&mut self) {
        if self.memos.is_empty() {
            if let Some(mut legacy_memo) = self.legacy_memo.take() {
                if legacy_memo.is_meaningful() {
                    if legacy_memo.id.trim().is_empty() {
                        legacy_memo.id = "memo-legacy".to_string();
                    }

                    self.memos.push(legacy_memo);
                }
            }
        } else {
            self.legacy_memo = None;
        }

        let mut seen_ids = HashSet::new();
        for (index, memo) in self.memos.iter_mut().enumerate() {
            if memo.id.trim().is_empty() || seen_ids.contains(&memo.id) {
                memo.id = format!("memo-{}", index + 1);
            }

            seen_ids.insert(memo.id.clone());
        }
    }

    fn ensure_default_signature(&mut self) {
        if self.signatures.is_empty() {
            return;
        }

        let default_count = self
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count();

        if default_count == 0 {
            if let Some(signature) = self.signatures.first_mut() {
                signature.is_default = true;
            }
            return;
        }

        if default_count > 1 {
            let mut seen_default = false;
            for signature in &mut self.signatures {
                if signature.is_default && seen_default {
                    signature.is_default = false;
                } else if signature.is_default {
                    seen_default = true;
                }
            }
        }
    }

    fn clean_broken_references(&mut self) {
        let template_ids: Vec<&str> = self
            .templates
            .iter()
            .map(|template| template.id.as_str())
            .chain(
                self.trash
                    .templates
                    .iter()
                    .map(|entry| entry.template.id.as_str()),
            )
            .collect();
        let signature_ids: Vec<&str> = self
            .signatures
            .iter()
            .map(|signature| signature.id.as_str())
            .chain(
                self.trash
                    .signatures
                    .iter()
                    .map(|entry| entry.signature.id.as_str()),
            )
            .collect();

        for draft in &mut self.drafts {
            if let Some(template_id) = draft.template_id.as_deref() {
                if !template_ids.contains(&template_id) {
                    draft.template_id = None;
                }
            }

            if let Some(signature_id) = draft.signature_id.as_deref() {
                if !signature_ids.contains(&signature_id) {
                    draft.signature_id = None;
                }
            }
        }

        for entry in &mut self.draft_history {
            if let Some(template_id) = entry.template_id.as_deref() {
                if !template_ids.contains(&template_id) {
                    entry.template_id = None;
                }
            }

            if let Some(signature_id) = entry.signature_id.as_deref() {
                if !signature_ids.contains(&signature_id) {
                    entry.signature_id = None;
                }
            }
        }

        for template in &mut self.templates {
            if let Some(signature_id) = template.signature_id.as_deref() {
                if !signature_ids.contains(&signature_id) {
                    template.signature_id = None;
                }
            }
        }
    }

    fn sort_by_recent(&mut self) {
        self.drafts.sort_by(|left, right| {
            right
                .is_pinned
                .cmp(&left.is_pinned)
                .then(right.updated_at.cmp(&left.updated_at))
        });
        self.draft_history
            .sort_by(|left, right| right.recorded_at.cmp(&left.recorded_at));
        self.templates.sort_by(|left, right| {
            right
                .is_pinned
                .cmp(&left.is_pinned)
                .then(right.updated_at.cmp(&left.updated_at))
        });
        self.variable_presets
            .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        self.signatures.sort_by(|left, right| {
            right
                .is_pinned
                .cmp(&left.is_pinned)
                .then(right.updated_at.cmp(&left.updated_at))
        });
        self.memos
            .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        self.trash
            .drafts
            .sort_by(|left, right| right.deleted_at.cmp(&left.deleted_at));
        self.trash
            .templates
            .sort_by(|left, right| right.deleted_at.cmp(&left.deleted_at));
        self.trash
            .signatures
            .sort_by(|left, right| right.deleted_at.cmp(&left.deleted_at));
    }

    pub fn empty_trash(&mut self) {
        self.trash = TrashSnapshot::default();
    }
}

#[cfg(test)]
mod tests {
    use std::collections::{BTreeMap, HashSet};

    use pretty_assertions::assert_eq;

    use super::StoreSnapshot;
    use crate::modules::{
        drafts::{Draft, DraftHistoryEntry},
        memo::Memo,
        templates::Template,
        trash::{TrashedDraft, TrashedSignature, TrashedTemplate},
    };

    fn sample_draft(id: &str, is_pinned: bool, updated_at: &str) -> Draft {
        Draft {
            id: id.to_string(),
            title: id.to_string(),
            is_pinned,
            subject: String::new(),
            recipient: String::new(),
            opening: String::new(),
            body: id.to_string(),
            closing: String::new(),
            template_id: None,
            signature_id: None,
            variable_values: BTreeMap::new(),
            created_at: "0".to_string(),
            updated_at: updated_at.to_string(),
        }
    }

    #[test]
    fn ensure_consistency_keeps_references_to_items_that_only_exist_in_trash() {
        let mut store = StoreSnapshot::seeded();
        store
            .draft_history
            .push(DraftHistoryEntry::from_draft(&store.drafts[0], "5"));

        let trashed_template = store.templates.remove(0);
        let trashed_signature = store.signatures.remove(0);
        store.trash.templates.push(TrashedTemplate {
            template: trashed_template.clone(),
            deleted_at: "10".to_string(),
        });
        store.trash.signatures.push(TrashedSignature {
            signature: trashed_signature.clone(),
            deleted_at: "11".to_string(),
        });
        store.templates.push(Template {
            id: "template-active".to_string(),
            name: "現役テンプレート".to_string(),
            is_pinned: false,
            subject: String::new(),
            recipient: String::new(),
            opening: String::new(),
            body: String::new(),
            closing: String::new(),
            signature_id: Some(trashed_signature.id.clone()),
            created_at: "12".to_string(),
            updated_at: "12".to_string(),
        });

        store.ensure_consistency();

        assert_eq!(
            store.drafts[0].template_id.as_deref(),
            Some(trashed_template.id.as_str())
        );
        assert_eq!(
            store.drafts[0].signature_id.as_deref(),
            Some(trashed_signature.id.as_str())
        );
        assert_eq!(
            store.draft_history[0].template_id.as_deref(),
            Some(trashed_template.id.as_str())
        );
        assert_eq!(
            store.draft_history[0].signature_id.as_deref(),
            Some(trashed_signature.id.as_str())
        );
        assert_eq!(
            store.templates[0].signature_id.as_deref(),
            Some(trashed_signature.id.as_str())
        );
    }

    #[test]
    fn ensure_consistency_normalizes_memo_ids_and_sorts_recent_items() {
        let mut store = StoreSnapshot::default();
        store.drafts = vec![
            sample_draft("draft-old", false, "10"),
            sample_draft("draft-pinned", true, "5"),
            sample_draft("draft-new", false, "20"),
        ];
        store.memos = vec![
            Memo {
                id: String::new(),
                title: "first".to_string(),
                is_pinned: false,
                body: String::new(),
                created_at: "0".to_string(),
                updated_at: "10".to_string(),
            },
            Memo {
                id: "memo-1".to_string(),
                title: "second".to_string(),
                is_pinned: false,
                body: String::new(),
                created_at: "0".to_string(),
                updated_at: "30".to_string(),
            },
            Memo {
                id: "memo-1".to_string(),
                title: "third".to_string(),
                is_pinned: false,
                body: String::new(),
                created_at: "0".to_string(),
                updated_at: "20".to_string(),
            },
        ];
        store.trash.drafts = vec![
            TrashedDraft {
                draft: sample_draft("trash-old", false, "0"),
                history: Vec::new(),
                deleted_at: "10".to_string(),
            },
            TrashedDraft {
                draft: sample_draft("trash-new", false, "0"),
                history: Vec::new(),
                deleted_at: "20".to_string(),
            },
        ];

        store.ensure_consistency();

        assert_eq!(
            store
                .drafts
                .iter()
                .map(|draft| draft.id.as_str())
                .collect::<Vec<_>>(),
            vec!["draft-pinned", "draft-new", "draft-old"]
        );
        assert_eq!(
            store
                .memos
                .iter()
                .map(|memo| memo.title.as_str())
                .collect::<Vec<_>>(),
            vec!["second", "third", "first"]
        );
        assert_eq!(
            store
                .trash
                .drafts
                .iter()
                .map(|entry| entry.draft.id.as_str())
                .collect::<Vec<_>>(),
            vec!["trash-new", "trash-old"]
        );

        let memo_ids = store
            .memos
            .iter()
            .map(|memo| memo.id.as_str())
            .collect::<HashSet<_>>();
        assert_eq!(memo_ids.len(), 3);
        assert_eq!(
            store.memos.iter().all(|memo| !memo.id.trim().is_empty()),
            true
        );
    }
}

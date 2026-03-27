use std::collections::HashSet;

use crate::modules::{tags::normalize_tags_in_place, trash::TrashSnapshot};

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn ensure_consistency(&mut self) {
        self.ensure_tags();
        self.ensure_memos();
        self.ensure_default_signature();
        self.clean_broken_references();
        self.sort_by_recent();
    }

    fn ensure_tags(&mut self) {
        for draft in &mut self.drafts {
            normalize_tags_in_place(&mut draft.tags);
        }

        for entry in &mut self.draft_history {
            normalize_tags_in_place(&mut entry.tags);
        }

        for template in &mut self.templates {
            normalize_tags_in_place(&mut template.tags);
        }

        for memo in &mut self.memos {
            normalize_tags_in_place(&mut memo.tags);
        }

        if let Some(legacy_memo) = &mut self.legacy_memo {
            normalize_tags_in_place(&mut legacy_memo.tags);
        }

        for entry in &mut self.trash.drafts {
            normalize_tags_in_place(&mut entry.draft.tags);
            for history in &mut entry.history {
                normalize_tags_in_place(&mut history.tags);
            }
        }

        for entry in &mut self.trash.templates {
            normalize_tags_in_place(&mut entry.template.tags);
        }

        for entry in &mut self.trash.memos {
            normalize_tags_in_place(&mut entry.memo.tags);
        }
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
    use std::{
        cmp::Ordering,
        collections::{BTreeMap, HashSet},
    };

    use pretty_assertions::assert_eq;
    use proptest::{collection::vec, option, prelude::*, string::string_regex};

    use super::StoreSnapshot;
    use crate::modules::{
        drafts::{Draft, DraftHistoryEntry},
        memo::Memo,
        signatures::Signature,
        templates::Template,
        trash::{TrashSnapshot, TrashedDraft, TrashedMemo, TrashedSignature, TrashedTemplate},
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
            tags: Vec::new(),
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
            tags: Vec::new(),
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
                tags: Vec::new(),
                created_at: "0".to_string(),
                updated_at: "10".to_string(),
            },
            Memo {
                id: "memo-1".to_string(),
                title: "second".to_string(),
                is_pinned: false,
                body: String::new(),
                tags: Vec::new(),
                created_at: "0".to_string(),
                updated_at: "30".to_string(),
            },
            Memo {
                id: "memo-1".to_string(),
                title: "third".to_string(),
                is_pinned: false,
                body: String::new(),
                tags: Vec::new(),
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

    #[test]
    fn ensure_consistency_normalizes_tags_across_active_and_trashed_items() {
        let mut store = StoreSnapshot::seeded();
        store.drafts[0].tags = vec![
            " 社外 ".to_string(),
            "".to_string(),
            "社外".to_string(),
            "営業".to_string(),
        ];
        store
            .draft_history
            .push(DraftHistoryEntry::from_draft(&store.drafts[0], "5"));
        store.draft_history[0].tags =
            vec![" 履歴 ".to_string(), "履歴".to_string(), "重要".to_string()];
        store.templates[0].tags = vec![" お礼 ".to_string(), "お礼".to_string()];
        store.legacy_memo = Some(Memo {
            id: String::new(),
            title: String::new(),
            is_pinned: false,
            body: String::new(),
            tags: vec![" 議事録 ".to_string(), "議事録".to_string()],
            created_at: "0".to_string(),
            updated_at: "1".to_string(),
        });

        let trashed_template = store.templates[0].clone();
        store.trash.templates.push(TrashedTemplate {
            template: trashed_template,
            deleted_at: "10".to_string(),
        });

        store.ensure_consistency();

        assert_eq!(
            store.drafts[0].tags,
            vec!["社外".to_string(), "営業".to_string()]
        );
        assert_eq!(
            store.draft_history[0].tags,
            vec!["履歴".to_string(), "重要".to_string()]
        );
        assert_eq!(store.templates[0].tags, vec!["お礼".to_string()]);
        assert_eq!(store.memos[0].tags, vec!["議事録".to_string()]);
        assert_eq!(
            store.trash.templates[0].template.tags,
            vec!["お礼".to_string()]
        );
    }

    fn arb_text() -> impl Strategy<Value = String> {
        string_regex("[a-c0-2 ]{0,6}").expect("text regex")
    }

    fn arb_short_id() -> impl Strategy<Value = String> {
        string_regex("[a-c0-2 ]{0,4}").expect("id regex")
    }

    fn arb_timestamp() -> impl Strategy<Value = String> {
        (0u16..50).prop_map(|value| value.to_string())
    }

    fn arb_variables() -> impl Strategy<Value = BTreeMap<String, String>> {
        prop::collection::btree_map(
            string_regex("[ab]{1,2}").expect("variable key regex"),
            arb_text(),
            0..3,
        )
    }

    prop_compose! {
        fn arb_signature()(
            id in arb_short_id(),
            name in arb_text(),
            is_pinned in any::<bool>(),
            body in arb_text(),
            is_default in any::<bool>(),
            created_at in arb_timestamp(),
            updated_at in arb_timestamp(),
        ) -> Signature {
            Signature {
                id,
                name,
                is_pinned,
                body,
                is_default,
                created_at,
                updated_at,
            }
        }
    }

    prop_compose! {
        fn arb_template()(
            id in arb_short_id(),
            name in arb_text(),
            is_pinned in any::<bool>(),
            subject in arb_text(),
            recipient in arb_text(),
            opening in arb_text(),
            body in arb_text(),
            closing in arb_text(),
            signature_id in option::of(arb_short_id()),
            created_at in arb_timestamp(),
            updated_at in arb_timestamp(),
        ) -> Template {
            Template {
                id,
                name,
                is_pinned,
                subject,
                recipient,
                opening,
                body,
                closing,
                signature_id,
                tags: Vec::new(),
                created_at,
                updated_at,
            }
        }
    }

    prop_compose! {
        fn arb_draft()(
            id in arb_short_id(),
            title in arb_text(),
            is_pinned in any::<bool>(),
            subject in arb_text(),
            recipient in arb_text(),
            opening in arb_text(),
            body in arb_text(),
            closing in arb_text(),
            template_id in option::of(arb_short_id()),
            signature_id in option::of(arb_short_id()),
            variable_values in arb_variables(),
            created_at in arb_timestamp(),
            updated_at in arb_timestamp(),
        ) -> Draft {
            Draft {
                id,
                title,
                is_pinned,
                subject,
                recipient,
                opening,
                body,
                closing,
                template_id,
                signature_id,
                variable_values,
                tags: Vec::new(),
                created_at,
                updated_at,
            }
        }
    }

    prop_compose! {
        fn arb_draft_history_entry()(
            id in arb_short_id(),
            draft_id in arb_short_id(),
            title in arb_text(),
            subject in arb_text(),
            recipient in arb_text(),
            opening in arb_text(),
            body in arb_text(),
            closing in arb_text(),
            template_id in option::of(arb_short_id()),
            signature_id in option::of(arb_short_id()),
            variable_values in arb_variables(),
            recorded_at in arb_timestamp(),
        ) -> DraftHistoryEntry {
            DraftHistoryEntry {
                id,
                draft_id,
                title,
                subject,
                recipient,
                opening,
                body,
                closing,
                template_id,
                signature_id,
                variable_values,
                tags: Vec::new(),
                recorded_at,
            }
        }
    }

    prop_compose! {
        fn arb_memo()(
            id in arb_short_id(),
            title in arb_text(),
            is_pinned in any::<bool>(),
            body in arb_text(),
            created_at in arb_timestamp(),
            updated_at in arb_timestamp(),
        ) -> Memo {
            Memo {
                id,
                title,
                is_pinned,
                body,
                tags: Vec::new(),
                created_at,
                updated_at,
            }
        }
    }

    prop_compose! {
        fn arb_trashed_draft()(
            draft in arb_draft(),
            history in vec(arb_draft_history_entry(), 0..3),
            deleted_at in arb_timestamp(),
        ) -> TrashedDraft {
            TrashedDraft { draft, history, deleted_at }
        }
    }

    prop_compose! {
        fn arb_trashed_template()(
            template in arb_template(),
            deleted_at in arb_timestamp(),
        ) -> TrashedTemplate {
            TrashedTemplate { template, deleted_at }
        }
    }

    prop_compose! {
        fn arb_trashed_signature()(
            signature in arb_signature(),
            deleted_at in arb_timestamp(),
        ) -> TrashedSignature {
            TrashedSignature { signature, deleted_at }
        }
    }

    prop_compose! {
        fn arb_trashed_memo()(
            memo in arb_memo(),
            deleted_at in arb_timestamp(),
        ) -> TrashedMemo {
            TrashedMemo { memo, deleted_at }
        }
    }

    prop_compose! {
        fn arb_store_snapshot()(
            drafts in vec(arb_draft(), 0..4),
            draft_history in vec(arb_draft_history_entry(), 0..5),
            templates in vec(arb_template(), 0..4),
            signatures in vec(arb_signature(), 0..4),
            memos in vec(arb_memo(), 0..5),
            legacy_memo in option::of(arb_memo()),
            trash_drafts in vec(arb_trashed_draft(), 0..3),
            trash_templates in vec(arb_trashed_template(), 0..3),
            trash_signatures in vec(arb_trashed_signature(), 0..3),
            trash_memos in vec(arb_trashed_memo(), 0..3),
        ) -> StoreSnapshot {
            StoreSnapshot {
                drafts,
                draft_history,
                variable_presets: Vec::new(),
                templates,
                signatures,
                memos,
                legacy_memo,
                trash: TrashSnapshot {
                    drafts: trash_drafts,
                    templates: trash_templates,
                    signatures: trash_signatures,
                    memos: trash_memos,
                },
            }
        }
    }

    fn assert_sorted<T>(items: &[T], compare: impl Fn(&T, &T) -> Ordering) {
        for pair in items.windows(2) {
            assert_ne!(compare(&pair[0], &pair[1]), Ordering::Greater);
        }
    }

    fn assert_consistent_snapshot(store: &StoreSnapshot, allow_trash_references: bool) {
        let assert_tags_normalized = |tags: &[String]| {
            let mut seen = HashSet::new();
            for tag in tags {
                assert_eq!(tag, tag.trim());
                assert!(!tag.is_empty());
                assert!(seen.insert(tag.clone()));
            }
        };

        let template_ids = store
            .templates
            .iter()
            .map(|template| template.id.as_str())
            .chain(
                allow_trash_references
                    .then(|| {
                        store
                            .trash
                            .templates
                            .iter()
                            .map(|entry| entry.template.id.as_str())
                    })
                    .into_iter()
                    .flatten(),
            )
            .collect::<HashSet<_>>();
        let signature_ids = store
            .signatures
            .iter()
            .map(|signature| signature.id.as_str())
            .chain(
                allow_trash_references
                    .then(|| {
                        store
                            .trash
                            .signatures
                            .iter()
                            .map(|entry| entry.signature.id.as_str())
                    })
                    .into_iter()
                    .flatten(),
            )
            .collect::<HashSet<_>>();

        if !store.signatures.is_empty() {
            assert_eq!(
                store
                    .signatures
                    .iter()
                    .filter(|signature| signature.is_default)
                    .count(),
                1
            );
        }

        let memo_ids = store
            .memos
            .iter()
            .map(|memo| memo.id.as_str())
            .collect::<HashSet<_>>();
        assert_eq!(memo_ids.len(), store.memos.len());
        assert!(store.memos.iter().all(|memo| !memo.id.trim().is_empty()));
        if !store.memos.is_empty() {
            assert!(store.legacy_memo.is_none());
        }

        for draft in &store.drafts {
            assert_tags_normalized(&draft.tags);
            if let Some(template_id) = draft.template_id.as_deref() {
                assert!(template_ids.contains(template_id));
            }
            if let Some(signature_id) = draft.signature_id.as_deref() {
                assert!(signature_ids.contains(signature_id));
            }
        }

        for entry in &store.draft_history {
            assert_tags_normalized(&entry.tags);
            if let Some(template_id) = entry.template_id.as_deref() {
                assert!(template_ids.contains(template_id));
            }
            if let Some(signature_id) = entry.signature_id.as_deref() {
                assert!(signature_ids.contains(signature_id));
            }
        }

        for template in &store.templates {
            assert_tags_normalized(&template.tags);
            if let Some(signature_id) = template.signature_id.as_deref() {
                assert!(signature_ids.contains(signature_id));
            }
        }

        for memo in &store.memos {
            assert_tags_normalized(&memo.tags);
        }

        assert_sorted(&store.drafts, |left, right| {
            right
                .is_pinned
                .cmp(&left.is_pinned)
                .then(right.updated_at.cmp(&left.updated_at))
        });
        assert_sorted(&store.draft_history, |left, right| {
            right.recorded_at.cmp(&left.recorded_at)
        });
        assert_sorted(&store.templates, |left, right| {
            right
                .is_pinned
                .cmp(&left.is_pinned)
                .then(right.updated_at.cmp(&left.updated_at))
        });
        assert_sorted(&store.signatures, |left, right| {
            right
                .is_pinned
                .cmp(&left.is_pinned)
                .then(right.updated_at.cmp(&left.updated_at))
        });
        assert_sorted(&store.memos, |left, right| {
            right.updated_at.cmp(&left.updated_at)
        });
        assert_sorted(&store.trash.drafts, |left, right| {
            right.deleted_at.cmp(&left.deleted_at)
        });
        assert_sorted(&store.trash.templates, |left, right| {
            right.deleted_at.cmp(&left.deleted_at)
        });
        assert_sorted(&store.trash.signatures, |left, right| {
            right.deleted_at.cmp(&left.deleted_at)
        });
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(64))]

        #[test]
        fn ensure_consistency_property_normalizes_random_snapshots(mut store in arb_store_snapshot()) {
            store.ensure_consistency();
            assert_consistent_snapshot(&store, true);
        }

        #[test]
        fn empty_trash_then_consistency_property_removes_purged_references(mut store in arb_store_snapshot()) {
            store.ensure_consistency();
            store.empty_trash();
            store.ensure_consistency();

            assert_eq!(store.trash.item_count(), 0);
            assert_consistent_snapshot(&store, false);
        }
    }
}

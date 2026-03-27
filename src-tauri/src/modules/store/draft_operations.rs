use crate::modules::{
    drafts::{Draft, DraftHistoryEntry, DraftInput},
    trash::TrashedDraft,
};

use super::{StoreSnapshot, DRAFT_HISTORY_INTERVAL_SECS, MAX_DRAFT_HISTORY_ENTRIES_PER_DRAFT};

impl StoreSnapshot {
    pub fn upsert_draft(&mut self, input: DraftInput, timestamp: &str) {
        if let Some(index) = self.drafts.iter().position(|draft| draft.id == input.id) {
            let existing = self.drafts[index].clone();
            if !existing.is_same_content(&input) {
                self.capture_draft_history(&existing, timestamp, false);
            }
            self.drafts[index].update(input, timestamp);
            return;
        }

        self.drafts.push(Draft::new(input, timestamp));
    }

    pub fn delete_draft(&mut self, id: &str, timestamp: &str) -> Option<TrashedDraft> {
        let Some(index) = self.drafts.iter().position(|draft| draft.id == id) else {
            return None;
        };

        let draft = self.drafts.remove(index);
        let history = self
            .draft_history
            .iter()
            .filter(|entry| entry.draft_id == id)
            .cloned()
            .collect();

        self.draft_history.retain(|entry| entry.draft_id != id);
        self.trash.drafts.retain(|entry| entry.draft.id != id);
        let trashed_draft = TrashedDraft {
            draft,
            history,
            deleted_at: timestamp.to_string(),
        };
        self.trash.drafts.push(trashed_draft.clone());
        Some(trashed_draft)
    }

    pub fn restore_draft_history(
        &mut self,
        draft_id: &str,
        history_id: &str,
        timestamp: &str,
    ) -> bool {
        let Some(entry) = self
            .draft_history
            .iter()
            .find(|entry| entry.draft_id == draft_id && entry.id == history_id)
            .cloned()
        else {
            return false;
        };

        let Some(index) = self.drafts.iter().position(|draft| draft.id == draft_id) else {
            return false;
        };

        let existing = self.drafts[index].clone();
        self.capture_draft_history(&existing, timestamp, true);
        self.drafts[index].restore(&entry, timestamp);
        true
    }

    fn capture_draft_history(&mut self, draft: &Draft, timestamp: &str, force: bool) {
        let draft_id = draft.id.clone();

        if !force {
            let Some(previous_recorded_at) = self
                .draft_history
                .iter()
                .find(|entry| entry.draft_id == draft_id)
                .map(|entry| entry.recorded_at.as_str())
            else {
                self.push_draft_history_entry(DraftHistoryEntry::from_draft(draft, timestamp));
                return;
            };

            if seconds_since(previous_recorded_at, timestamp) < DRAFT_HISTORY_INTERVAL_SECS {
                return;
            }
        }

        self.push_draft_history_entry(DraftHistoryEntry::from_draft(draft, timestamp));
    }

    fn push_draft_history_entry(&mut self, entry: DraftHistoryEntry) {
        let draft_id = entry.draft_id.clone();
        self.draft_history
            .retain(|existing| !(existing.draft_id == draft_id && existing.id == entry.id));
        self.draft_history.push(entry);
        self.draft_history
            .sort_by(|left, right| right.recorded_at.cmp(&left.recorded_at));

        let mut retained = 0usize;
        self.draft_history.retain(|existing| {
            if existing.draft_id != draft_id {
                return true;
            }

            retained += 1;
            retained <= MAX_DRAFT_HISTORY_ENTRIES_PER_DRAFT
        });
    }
}

fn seconds_since(previous: &str, current: &str) -> u64 {
    let previous = previous.parse::<u64>().unwrap_or_default();
    let current = current.parse::<u64>().unwrap_or_default();

    current.saturating_sub(previous)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use pretty_assertions::assert_eq;

    use super::StoreSnapshot;
    use crate::modules::drafts::DraftInput;

    fn draft_input(id: &str, body: &str) -> DraftInput {
        DraftInput {
            id: id.to_string(),
            title: "履歴テスト".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: body.to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: None,
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
            tags: Vec::new(),
        }
    }

    #[test]
    fn restore_draft_history_forces_a_snapshot_of_the_current_state() {
        let mut store = StoreSnapshot::seeded();
        let draft_id = store.drafts[0].id.clone();
        let original_body = store.drafts[0].body.clone();

        store.upsert_draft(draft_input(&draft_id, "一回目"), "100");
        store.upsert_draft(draft_input(&draft_id, "二回目"), "110");
        let history_id = store.draft_history[0].id.clone();

        let restored = store.restore_draft_history(&draft_id, &history_id, "115");

        assert_eq!(restored, true);
        assert_eq!(store.drafts[0].body, original_body);
        assert_eq!(store.draft_history.len(), 2);
        assert_eq!(store.draft_history[0].body, "二回目");
        assert_eq!(store.draft_history[0].recorded_at, "115");
        assert_eq!(store.draft_history[1].body, original_body);
    }

    #[test]
    fn push_draft_history_entry_keeps_only_the_most_recent_entries_per_draft() {
        let mut store = StoreSnapshot::seeded();
        let draft_id = store.drafts[0].id.clone();

        for index in 0..25 {
            let timestamp = (100 + index * 30).to_string();
            store.upsert_draft(
                draft_input(&draft_id, &format!("本文-{index}")),
                timestamp.as_str(),
            );
        }

        assert_eq!(store.draft_history.len(), 20);
        assert_eq!(store.draft_history[0].body, "本文-23");
        assert_eq!(store.draft_history[19].body, "本文-4");
    }
}

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

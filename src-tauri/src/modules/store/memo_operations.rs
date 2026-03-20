use crate::modules::memo::{Memo, MemoInput};
use crate::modules::trash::TrashedMemo;

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn upsert_memo(&mut self, input: MemoInput, timestamp: &str) -> Memo {
        if let Some(existing) = self.memos.iter_mut().find(|memo| memo.id == input.id) {
            existing.update(input, timestamp);
            return existing.clone();
        }

        let memo = Memo::new(input, timestamp);
        self.memos.push(memo.clone());
        memo
    }

    pub fn delete_memo(&mut self, id: &str, timestamp: &str) -> Option<TrashedMemo> {
        let index = self.memos.iter().position(|memo| memo.id == id)?;
        let memo = self.memos.remove(index);
        let trashed_memo = TrashedMemo {
            memo,
            deleted_at: timestamp.to_string(),
        };

        self.trash.memos.retain(|entry| entry.memo.id != id);
        self.trash.memos.insert(0, trashed_memo.clone());
        Some(trashed_memo)
    }
}

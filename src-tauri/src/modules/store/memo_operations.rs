use crate::modules::memo::{Memo, MemoInput};

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

    pub fn delete_memo(&mut self, id: &str) -> bool {
        let initial_len = self.memos.len();
        self.memos.retain(|memo| memo.id != id);
        initial_len != self.memos.len()
    }
}

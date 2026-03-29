use crate::modules::{
    blocks::{ContentBlock, ContentBlockInput},
    trash::TrashedBlock,
};

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn upsert_block(&mut self, input: ContentBlockInput, timestamp: &str) -> ContentBlock {
        if let Some(existing) = self.blocks.iter_mut().find(|block| block.id == input.id) {
            existing.update(input, timestamp);
            return existing.clone();
        }

        let block = ContentBlock::new(input, timestamp);
        self.blocks.push(block.clone());
        block
    }

    pub fn delete_block(&mut self, id: &str, timestamp: &str) -> Option<TrashedBlock> {
        let index = self.blocks.iter().position(|block| block.id == id)?;
        let block = self.blocks.remove(index);
        let trashed_block = TrashedBlock {
            block,
            deleted_at: timestamp.to_string(),
        };

        self.trash.blocks.retain(|entry| entry.block.id != id);
        self.trash.blocks.insert(0, trashed_block.clone());
        Some(trashed_block)
    }
}

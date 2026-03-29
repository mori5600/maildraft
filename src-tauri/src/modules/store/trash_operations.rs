use crate::modules::store::StoreSnapshot;
use crate::modules::{
    blocks::ContentBlock, memo::Memo, signatures::Signature, templates::Template,
    trash::TrashedDraft,
};

impl StoreSnapshot {
    pub fn restore_draft_from_trash(&mut self, id: &str) -> Option<TrashedDraft> {
        if self.drafts.iter().any(|draft| draft.id == id) {
            return None;
        }

        let Some(index) = self
            .trash
            .drafts
            .iter()
            .position(|entry| entry.draft.id == id)
        else {
            return None;
        };

        let entry = self.trash.drafts.remove(index);
        self.draft_history.retain(|history| history.draft_id != id);
        self.drafts.push(entry.draft.clone());
        self.draft_history.extend(entry.history.clone());
        Some(entry)
    }

    pub fn restore_template_from_trash(&mut self, id: &str) -> Option<Template> {
        if self.templates.iter().any(|template| template.id == id) {
            return None;
        }

        let Some(index) = self
            .trash
            .templates
            .iter()
            .position(|entry| entry.template.id == id)
        else {
            return None;
        };

        let entry = self.trash.templates.remove(index);
        self.templates.push(entry.template.clone());
        Some(entry.template)
    }

    pub fn restore_signature_from_trash(&mut self, id: &str) -> Option<Signature> {
        if self.signatures.iter().any(|signature| signature.id == id) {
            return None;
        }

        let Some(index) = self
            .trash
            .signatures
            .iter()
            .position(|entry| entry.signature.id == id)
        else {
            return None;
        };

        let entry = self.trash.signatures.remove(index);
        self.signatures.push(entry.signature.clone());
        Some(entry.signature)
    }

    pub fn restore_memo_from_trash(&mut self, id: &str) -> Option<Memo> {
        if self.memos.iter().any(|memo| memo.id == id) {
            return None;
        }

        let Some(index) = self
            .trash
            .memos
            .iter()
            .position(|entry| entry.memo.id == id)
        else {
            return None;
        };

        let entry = self.trash.memos.remove(index);
        self.memos.push(entry.memo.clone());
        Some(entry.memo)
    }

    pub fn restore_block_from_trash(&mut self, id: &str) -> Option<ContentBlock> {
        if self.blocks.iter().any(|block| block.id == id) {
            return None;
        }

        let Some(index) = self
            .trash
            .blocks
            .iter()
            .position(|entry| entry.block.id == id)
        else {
            return None;
        };

        let entry = self.trash.blocks.remove(index);
        self.blocks.push(entry.block.clone());
        Some(entry.block)
    }

    pub fn permanently_delete_draft_from_trash(&mut self, id: &str) -> bool {
        let initial_len = self.trash.drafts.len();
        self.trash.drafts.retain(|entry| entry.draft.id != id);
        initial_len != self.trash.drafts.len()
    }

    pub fn permanently_delete_template_from_trash(&mut self, id: &str) -> bool {
        let initial_len = self.trash.templates.len();
        self.trash.templates.retain(|entry| entry.template.id != id);
        initial_len != self.trash.templates.len()
    }

    pub fn permanently_delete_signature_from_trash(&mut self, id: &str) -> bool {
        let initial_len = self.trash.signatures.len();
        self.trash
            .signatures
            .retain(|entry| entry.signature.id != id);
        initial_len != self.trash.signatures.len()
    }

    pub fn permanently_delete_memo_from_trash(&mut self, id: &str) -> bool {
        let initial_len = self.trash.memos.len();
        self.trash.memos.retain(|entry| entry.memo.id != id);
        initial_len != self.trash.memos.len()
    }

    pub fn permanently_delete_block_from_trash(&mut self, id: &str) -> bool {
        let initial_len = self.trash.blocks.len();
        self.trash.blocks.retain(|entry| entry.block.id != id);
        initial_len != self.trash.blocks.len()
    }
}

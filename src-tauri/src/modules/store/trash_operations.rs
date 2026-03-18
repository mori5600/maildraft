use crate::modules::store::StoreSnapshot;
use crate::modules::{
    signatures::Signature,
    templates::Template,
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
}

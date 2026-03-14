use crate::modules::trash::TrashSnapshot;

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn ensure_consistency(&mut self) {
        self.ensure_default_signature();
        self.clean_broken_references();
        self.sort_by_recent();
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

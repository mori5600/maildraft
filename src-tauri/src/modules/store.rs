use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::modules::{
    drafts::{Draft, DraftHistoryEntry, DraftInput},
    signatures::{Signature, SignatureInput},
    templates::{Template, TemplateInput},
    trash::{TrashSnapshot, TrashedDraft, TrashedSignature, TrashedTemplate},
    variable_presets::{VariablePreset, VariablePresetInput},
};

const MAX_DRAFT_HISTORY_ENTRIES_PER_DRAFT: usize = 20;
const DRAFT_HISTORY_INTERVAL_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoreSnapshot {
    #[serde(default)]
    pub drafts: Vec<Draft>,
    #[serde(default)]
    pub draft_history: Vec<DraftHistoryEntry>,
    #[serde(default)]
    pub variable_presets: Vec<VariablePreset>,
    #[serde(default)]
    pub templates: Vec<Template>,
    #[serde(default)]
    pub signatures: Vec<Signature>,
    #[serde(default)]
    pub trash: TrashSnapshot,
}

impl StoreSnapshot {
    pub fn seeded() -> Self {
        let timestamp = "0";
        let signature = Signature {
            id: "signature-default".to_string(),
            name: "標準署名".to_string(),
            is_pinned: false,
            body: "MailDraft Inc.\n山田 太郎\nProduct Team".to_string(),
            is_default: true,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        let template = Template {
            id: "template-thanks".to_string(),
            name: "お礼メール".to_string(),
            is_pinned: false,
            subject: "お打ち合わせのお礼".to_string(),
            recipient: "株式会社サンプル\n営業部\n佐藤 様".to_string(),
            opening: "いつもお世話になっております。\nMailDraft の山田です。".to_string(),
            body: "先日は {{案件名}} のお打ち合わせのお時間をいただき、ありがとうございました。\nお話しした内容を踏まえて、次のご提案を整理してご連絡します。".to_string(),
            closing: "引き続きよろしくお願いいたします。".to_string(),
            signature_id: Some(signature.id.clone()),
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        let draft = Draft {
            id: "draft-welcome".to_string(),
            title: "最初の下書き".to_string(),
            is_pinned: false,
            subject: template.subject.clone(),
            recipient: template.recipient.clone(),
            opening: "いつもお世話になっております。\nMailDraft の山田です。".to_string(),
            body: "本日はメール下書きエディタのご相談でお時間をいただき、ありがとうございました。\nご相談いただいた内容を社内で整理のうえ、改めてご連絡いたします。".to_string(),
            closing: "引き続きよろしくお願いいたします。".to_string(),
            template_id: Some(template.id.clone()),
            signature_id: Some(signature.id.clone()),
            variable_values: BTreeMap::from([(
                "案件名".to_string(),
                "メール下書きエディタ".to_string(),
            )]),
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        Self {
            drafts: vec![draft],
            draft_history: Vec::new(),
            variable_presets: Vec::new(),
            templates: vec![template],
            signatures: vec![signature],
            trash: TrashSnapshot::default(),
        }
    }

    pub fn ensure_consistency(&mut self) {
        self.ensure_default_signature();
        self.clean_broken_references();
        self.sort_by_recent();
    }

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

    pub fn delete_draft(&mut self, id: &str, timestamp: &str) {
        let Some(index) = self.drafts.iter().position(|draft| draft.id == id) else {
            return;
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
        self.trash.drafts.push(TrashedDraft {
            draft,
            history,
            deleted_at: timestamp.to_string(),
        });
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

    pub fn upsert_template(&mut self, input: TemplateInput, timestamp: &str) {
        if let Some(existing) = self
            .templates
            .iter_mut()
            .find(|template| template.id == input.id)
        {
            existing.update(input, timestamp);
            return;
        }

        self.templates.push(Template::new(input, timestamp));
    }

    pub fn upsert_variable_preset(&mut self, input: VariablePresetInput, timestamp: &str) {
        if let Some(existing) = self
            .variable_presets
            .iter_mut()
            .find(|preset| preset.id == input.id)
        {
            existing.update(input, timestamp);
            return;
        }

        self.variable_presets
            .push(VariablePreset::new(input, timestamp));
    }

    pub fn delete_variable_preset(&mut self, id: &str) -> bool {
        let initial_len = self.variable_presets.len();
        self.variable_presets.retain(|preset| preset.id != id);
        initial_len != self.variable_presets.len()
    }

    pub fn delete_template(&mut self, id: &str, timestamp: &str) {
        let Some(index) = self.templates.iter().position(|template| template.id == id) else {
            return;
        };

        let template = self.templates.remove(index);
        self.trash.templates.retain(|entry| entry.template.id != id);
        self.trash.templates.push(TrashedTemplate {
            template,
            deleted_at: timestamp.to_string(),
        });
    }

    pub fn upsert_signature(&mut self, input: SignatureInput, timestamp: &str) {
        if input.is_default {
            for signature in &mut self.signatures {
                signature.is_default = false;
            }
        }

        if let Some(existing) = self
            .signatures
            .iter_mut()
            .find(|signature| signature.id == input.id)
        {
            existing.update(input, timestamp);
            return;
        }

        self.signatures.push(Signature::new(input, timestamp));
    }

    pub fn delete_signature(&mut self, id: &str, timestamp: &str) {
        let Some(index) = self
            .signatures
            .iter()
            .position(|signature| signature.id == id)
        else {
            return;
        };

        let signature = self.signatures.remove(index);
        self.trash
            .signatures
            .retain(|entry| entry.signature.id != id);
        self.trash.signatures.push(TrashedSignature {
            signature,
            deleted_at: timestamp.to_string(),
        });
    }

    pub fn restore_draft_from_trash(&mut self, id: &str) -> bool {
        if self.drafts.iter().any(|draft| draft.id == id) {
            return false;
        }

        let Some(index) = self
            .trash
            .drafts
            .iter()
            .position(|entry| entry.draft.id == id)
        else {
            return false;
        };

        let entry = self.trash.drafts.remove(index);
        self.draft_history.retain(|history| history.draft_id != id);
        self.drafts.push(entry.draft);
        self.draft_history.extend(entry.history);
        true
    }

    pub fn restore_template_from_trash(&mut self, id: &str) -> bool {
        if self.templates.iter().any(|template| template.id == id) {
            return false;
        }

        let Some(index) = self
            .trash
            .templates
            .iter()
            .position(|entry| entry.template.id == id)
        else {
            return false;
        };

        let entry = self.trash.templates.remove(index);
        self.templates.push(entry.template);
        true
    }

    pub fn restore_signature_from_trash(&mut self, id: &str) -> bool {
        if self.signatures.iter().any(|signature| signature.id == id) {
            return false;
        }

        let Some(index) = self
            .trash
            .signatures
            .iter()
            .position(|entry| entry.signature.id == id)
        else {
            return false;
        };

        let entry = self.trash.signatures.remove(index);
        self.signatures.push(entry.signature);
        true
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

    pub fn empty_trash(&mut self) {
        self.trash = TrashSnapshot::default();
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

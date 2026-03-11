use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::modules::{
    drafts::{Draft, DraftHistoryEntry, DraftInput},
    signatures::{Signature, SignatureInput},
    templates::{Template, TemplateInput},
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
    pub templates: Vec<Template>,
    #[serde(default)]
    pub signatures: Vec<Signature>,
}

impl StoreSnapshot {
    pub fn seeded() -> Self {
        let timestamp = "0";
        let signature = Signature {
            id: "signature-default".to_string(),
            name: "標準署名".to_string(),
            body: "MailDraft Inc.\n山田 太郎\nProduct Team".to_string(),
            is_default: true,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        let template = Template {
            id: "template-thanks".to_string(),
            name: "お礼メール".to_string(),
            subject: "お打ち合わせのお礼".to_string(),
            opening: "{{相手名}} 様".to_string(),
            body: "本日はお時間をいただき、ありがとうございました。\nお話しした内容を踏まえて、次のご提案を整理してご連絡します。".to_string(),
            closing: "引き続きよろしくお願いいたします。".to_string(),
            signature_id: Some(signature.id.clone()),
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        let draft = Draft {
            id: "draft-welcome".to_string(),
            title: "最初の下書き".to_string(),
            subject: template.subject.clone(),
            recipient: "株式会社サンプル 御中".to_string(),
            opening: "株式会社サンプル\n佐藤 様".to_string(),
            body: "本日はお時間をいただき、ありがとうございました。\nご相談いただいた件について、社内で整理のうえ改めてご連絡いたします。".to_string(),
            closing: "引き続きよろしくお願いいたします。".to_string(),
            template_id: Some(template.id.clone()),
            signature_id: Some(signature.id.clone()),
            variable_values: BTreeMap::new(),
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        Self {
            drafts: vec![draft],
            draft_history: Vec::new(),
            templates: vec![template],
            signatures: vec![signature],
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

    pub fn delete_draft(&mut self, id: &str) {
        self.drafts.retain(|draft| draft.id != id);
        self.draft_history.retain(|entry| entry.draft_id != id);
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

    pub fn delete_template(&mut self, id: &str) {
        self.templates.retain(|template| template.id != id);
        for draft in &mut self.drafts {
            if draft.template_id.as_deref() == Some(id) {
                draft.template_id = None;
            }
        }
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

    pub fn delete_signature(&mut self, id: &str) {
        self.signatures.retain(|signature| signature.id != id);

        for draft in &mut self.drafts {
            if draft.signature_id.as_deref() == Some(id) {
                draft.signature_id = None;
            }
        }

        for template in &mut self.templates {
            if template.signature_id.as_deref() == Some(id) {
                template.signature_id = None;
            }
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
            .collect();
        let signature_ids: Vec<&str> = self
            .signatures
            .iter()
            .map(|signature| signature.id.as_str())
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
        self.drafts
            .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        self.draft_history
            .sort_by(|left, right| right.recorded_at.cmp(&left.recorded_at));
        self.templates
            .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        self.signatures
            .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
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

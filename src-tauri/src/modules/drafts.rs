use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftHistoryEntry {
    pub id: String,
    pub draft_id: String,
    pub title: String,
    pub subject: String,
    pub recipient: String,
    pub opening: String,
    pub body: String,
    pub closing: String,
    pub template_id: Option<String>,
    pub signature_id: Option<String>,
    #[serde(default)]
    pub variable_values: BTreeMap<String, String>,
    pub recorded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub title: String,
    pub subject: String,
    pub recipient: String,
    pub opening: String,
    pub body: String,
    pub closing: String,
    pub template_id: Option<String>,
    pub signature_id: Option<String>,
    #[serde(default)]
    pub variable_values: BTreeMap<String, String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftInput {
    pub id: String,
    pub title: String,
    pub subject: String,
    pub recipient: String,
    pub opening: String,
    pub body: String,
    pub closing: String,
    pub template_id: Option<String>,
    pub signature_id: Option<String>,
    #[serde(default)]
    pub variable_values: BTreeMap<String, String>,
}

impl Draft {
    pub fn new(input: DraftInput, timestamp: &str) -> Self {
        Self {
            id: input.id,
            title: input.title,
            subject: input.subject,
            recipient: input.recipient,
            opening: input.opening,
            body: input.body,
            closing: input.closing,
            template_id: input.template_id,
            signature_id: input.signature_id,
            variable_values: input.variable_values,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        }
    }

    pub fn update(&mut self, input: DraftInput, timestamp: &str) {
        self.title = input.title;
        self.subject = input.subject;
        self.recipient = input.recipient;
        self.opening = input.opening;
        self.body = input.body;
        self.closing = input.closing;
        self.template_id = input.template_id;
        self.signature_id = input.signature_id;
        self.variable_values = input.variable_values;
        self.updated_at = timestamp.to_string();
    }

    pub fn restore(&mut self, entry: &DraftHistoryEntry, timestamp: &str) {
        self.title = entry.title.clone();
        self.subject = entry.subject.clone();
        self.recipient = entry.recipient.clone();
        self.opening = entry.opening.clone();
        self.body = entry.body.clone();
        self.closing = entry.closing.clone();
        self.template_id = entry.template_id.clone();
        self.signature_id = entry.signature_id.clone();
        self.variable_values = entry.variable_values.clone();
        self.updated_at = timestamp.to_string();
    }

    pub fn is_same_content(&self, input: &DraftInput) -> bool {
        self.title == input.title
            && self.subject == input.subject
            && self.recipient == input.recipient
            && self.opening == input.opening
            && self.body == input.body
            && self.closing == input.closing
            && self.template_id == input.template_id
            && self.signature_id == input.signature_id
            && self.variable_values == input.variable_values
    }
}

impl DraftHistoryEntry {
    pub fn from_draft(draft: &Draft, recorded_at: &str) -> Self {
        Self {
            id: format!("{}-{recorded_at}", draft.id),
            draft_id: draft.id.clone(),
            title: draft.title.clone(),
            subject: draft.subject.clone(),
            recipient: draft.recipient.clone(),
            opening: draft.opening.clone(),
            body: draft.body.clone(),
            closing: draft.closing.clone(),
            template_id: draft.template_id.clone(),
            signature_id: draft.signature_id.clone(),
            variable_values: draft.variable_values.clone(),
            recorded_at: recorded_at.to_string(),
        }
    }
}

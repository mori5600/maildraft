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
    #[serde(default)]
    pub is_pinned: bool,
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
    #[serde(default)]
    pub is_pinned: bool,
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
            is_pinned: input.is_pinned,
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
        self.is_pinned = input.is_pinned;
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
        self.is_pinned = false;
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
            && self.is_pinned == input.is_pinned
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

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use pretty_assertions::assert_eq;

    use super::{Draft, DraftHistoryEntry, DraftInput};

    fn sample_input() -> DraftInput {
        DraftInput {
            id: "draft-1".to_string(),
            title: "下書き".to_string(),
            is_pinned: true,
            subject: "件名".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "本文".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: Some("template-1".to_string()),
            signature_id: Some("signature-1".to_string()),
            variable_values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
        }
    }

    #[test]
    fn draft_new_and_update_copy_values_from_input() {
        let mut draft = Draft::new(sample_input(), "10");
        assert_eq!(draft.updated_at, "10");
        assert_eq!(draft.title, "下書き");
        assert_eq!(draft.variable_values["会社名"], "株式会社〇〇");

        let mut next_input = sample_input();
        next_input.title = "更新後".to_string();
        next_input.is_pinned = false;
        next_input.body = "更新本文".to_string();
        draft.update(next_input, "20");

        assert_eq!(draft.title, "更新後");
        assert_eq!(draft.is_pinned, false);
        assert_eq!(draft.body, "更新本文");
        assert_eq!(draft.updated_at, "20");
    }

    #[test]
    fn draft_restore_and_is_same_content_behave_as_expected() {
        let mut draft = Draft::new(sample_input(), "10");
        let history = DraftHistoryEntry::from_draft(&draft, "15");

        draft.title = "変更後".to_string();
        draft.is_pinned = true;
        draft.restore(&history, "30");

        assert_eq!(draft.title, "下書き");
        assert_eq!(draft.is_pinned, false);
        assert_eq!(draft.updated_at, "30");

        let matching_input = sample_input();
        assert_eq!(draft.is_same_content(&matching_input), false);
        draft.is_pinned = true;
        assert_eq!(draft.is_same_content(&matching_input), true);
    }
}

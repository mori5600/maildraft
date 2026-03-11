use serde::{Deserialize, Serialize};

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
        self.updated_at = timestamp.to_string();
    }
}

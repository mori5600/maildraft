use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_pinned: bool,
    pub subject: String,
    pub opening: String,
    pub body: String,
    pub closing: String,
    pub signature_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_pinned: bool,
    pub subject: String,
    pub opening: String,
    pub body: String,
    pub closing: String,
    pub signature_id: Option<String>,
}

impl Template {
    pub fn new(input: TemplateInput, timestamp: &str) -> Self {
        Self {
            id: input.id,
            name: input.name,
            is_pinned: input.is_pinned,
            subject: input.subject,
            opening: input.opening,
            body: input.body,
            closing: input.closing,
            signature_id: input.signature_id,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        }
    }

    pub fn update(&mut self, input: TemplateInput, timestamp: &str) {
        self.name = input.name;
        self.is_pinned = input.is_pinned;
        self.subject = input.subject;
        self.opening = input.opening;
        self.body = input.body;
        self.closing = input.closing;
        self.signature_id = input.signature_id;
        self.updated_at = timestamp.to_string();
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Signature {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_pinned: bool,
    pub body: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_pinned: bool,
    pub body: String,
    pub is_default: bool,
}

impl Signature {
    pub fn new(input: SignatureInput, timestamp: &str) -> Self {
        Self {
            id: input.id,
            name: input.name,
            is_pinned: input.is_pinned,
            body: input.body,
            is_default: input.is_default,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        }
    }

    pub fn update(&mut self, input: SignatureInput, timestamp: &str) {
        self.name = input.name;
        self.is_pinned = input.is_pinned;
        self.body = input.body;
        self.is_default = input.is_default;
        self.updated_at = timestamp.to_string();
    }
}

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

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{Signature, SignatureInput};

    #[test]
    fn signature_new_and_update_keep_fields_in_sync() {
        let mut signature = Signature::new(
            SignatureInput {
                id: "signature-1".to_string(),
                name: "標準署名".to_string(),
                is_pinned: true,
                body: "本文".to_string(),
                is_default: true,
            },
            "10",
        );

        assert_eq!(signature.created_at, "10");
        assert_eq!(signature.updated_at, "10");
        assert_eq!(signature.is_default, true);

        signature.update(
            SignatureInput {
                id: "signature-1".to_string(),
                name: "営業署名".to_string(),
                is_pinned: false,
                body: "更新本文".to_string(),
                is_default: false,
            },
            "20",
        );

        assert_eq!(signature.name, "営業署名");
        assert_eq!(signature.is_pinned, false);
        assert_eq!(signature.body, "更新本文");
        assert_eq!(signature.is_default, false);
        assert_eq!(signature.updated_at, "20");
    }
}

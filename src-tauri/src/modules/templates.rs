use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_pinned: bool,
    pub subject: String,
    #[serde(default)]
    pub recipient: String,
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
    #[serde(default)]
    pub recipient: String,
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
            recipient: input.recipient,
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
        self.recipient = input.recipient;
        self.opening = input.opening;
        self.body = input.body;
        self.closing = input.closing;
        self.signature_id = input.signature_id;
        self.updated_at = timestamp.to_string();
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{Template, TemplateInput};

    #[test]
    fn template_new_and_update_keep_fields_in_sync() {
        let mut template = Template::new(
            TemplateInput {
                id: "template-1".to_string(),
                name: "お礼メール".to_string(),
                is_pinned: true,
                subject: "件名".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "本文".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                signature_id: Some("signature-1".to_string()),
            },
            "10",
        );

        assert_eq!(template.created_at, "10");
        assert_eq!(template.updated_at, "10");
        assert_eq!(template.name, "お礼メール");

        template.update(
            TemplateInput {
                id: "template-1".to_string(),
                name: "日程調整".to_string(),
                is_pinned: false,
                subject: "更新件名".to_string(),
                recipient: "".to_string(),
                opening: "更新書き出し".to_string(),
                body: "更新本文".to_string(),
                closing: "".to_string(),
                signature_id: None,
            },
            "20",
        );

        assert_eq!(template.name, "日程調整");
        assert_eq!(template.is_pinned, false);
        assert_eq!(template.subject, "更新件名");
        assert_eq!(template.signature_id, None);
        assert_eq!(template.updated_at, "20");
    }
}

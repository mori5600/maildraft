use serde::{Deserialize, Serialize};

use crate::modules::tags::normalize_tags;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ContentBlockCategory {
    Greeting,
    Request,
    Thanks,
    Reminder,
    Decline,
    Other,
}

impl ContentBlockCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Greeting => "greeting",
            Self::Request => "request",
            Self::Thanks => "thanks",
            Self::Reminder => "reminder",
            Self::Decline => "decline",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContentBlock {
    pub id: String,
    pub name: String,
    pub category: ContentBlockCategory,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContentBlockInput {
    pub id: String,
    pub name: String,
    pub category: ContentBlockCategory,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ContentBlock {
    pub fn new(input: ContentBlockInput, timestamp: &str) -> Self {
        let input = input.normalized();
        Self {
            id: input.id,
            name: input.name,
            category: input.category,
            body: input.body,
            tags: input.tags,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        }
    }

    pub fn update(&mut self, input: ContentBlockInput, timestamp: &str) {
        let input = input.normalized();
        self.name = input.name;
        self.category = input.category;
        self.body = input.body;
        self.tags = input.tags;
        self.updated_at = timestamp.to_string();
    }
}

impl ContentBlockInput {
    pub fn normalized(mut self) -> Self {
        self.tags = normalize_tags(self.tags);
        self
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{ContentBlock, ContentBlockCategory, ContentBlockInput};

    #[test]
    fn content_block_new_and_update_keep_fields_in_sync() {
        let mut block = ContentBlock::new(
            ContentBlockInput {
                id: "block-1".to_string(),
                name: "冒頭あいさつ".to_string(),
                category: ContentBlockCategory::Greeting,
                body: "いつもお世話になっております。".to_string(),
                tags: vec!["社外".to_string(), "挨拶".to_string()],
            },
            "10",
        );

        assert_eq!(block.created_at, "10");
        assert_eq!(block.updated_at, "10");
        assert_eq!(block.category, ContentBlockCategory::Greeting);
        assert_eq!(block.tags, vec!["社外".to_string(), "挨拶".to_string()]);

        block.update(
            ContentBlockInput {
                id: "block-1".to_string(),
                name: "催促".to_string(),
                category: ContentBlockCategory::Reminder,
                body: "ご確認状況をお知らせください。".to_string(),
                tags: vec![" 催促 ".to_string(), "催促".to_string()],
            },
            "20",
        );

        assert_eq!(block.name, "催促");
        assert_eq!(block.category, ContentBlockCategory::Reminder);
        assert_eq!(block.body, "ご確認状況をお知らせください。");
        assert_eq!(block.tags, vec!["催促".to_string()]);
        assert_eq!(block.updated_at, "20");
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Memo {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(default)]
    pub body: String,
    #[serde(default = "default_memo_timestamp")]
    pub created_at: String,
    #[serde(default = "default_memo_timestamp")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoInput {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(default)]
    pub body: String,
}

impl Default for Memo {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            is_pinned: false,
            body: String::new(),
            created_at: default_memo_timestamp(),
            updated_at: default_memo_timestamp(),
        }
    }
}

impl Memo {
    pub fn new(input: MemoInput, timestamp: &str) -> Self {
        Self {
            id: input.id,
            title: input.title,
            is_pinned: input.is_pinned,
            body: input.body,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        }
    }

    pub fn update(&mut self, input: MemoInput, timestamp: &str) {
        self.id = input.id;
        self.title = input.title;
        self.is_pinned = input.is_pinned;
        self.body = input.body;
        self.updated_at = timestamp.to_string();
    }

    pub fn is_meaningful(&self) -> bool {
        self.is_pinned || !self.title.trim().is_empty() || !self.body.trim().is_empty()
    }
}

fn default_memo_timestamp() -> String {
    "0".to_string()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{Memo, MemoInput};

    #[test]
    fn memo_new_and_update_keep_fields_in_sync() {
        let mut memo = Memo::new(
            MemoInput {
                id: "memo-1".to_string(),
                title: "商談メモ".to_string(),
                is_pinned: true,
                body: "初回ヒアリング".to_string(),
            },
            "10",
        );

        assert_eq!(memo.id, "memo-1");
        assert_eq!(memo.title, "商談メモ");
        assert_eq!(memo.is_pinned, true);
        assert_eq!(memo.body, "初回ヒアリング");
        assert_eq!(memo.created_at, "10");
        assert_eq!(memo.updated_at, "10");

        memo.update(
            MemoInput {
                id: "memo-1".to_string(),
                title: "更新後".to_string(),
                is_pinned: false,
                body: "次回宿題".to_string(),
            },
            "20",
        );

        assert_eq!(memo.title, "更新後");
        assert_eq!(memo.is_pinned, false);
        assert_eq!(memo.body, "次回宿題");
        assert_eq!(memo.created_at, "10");
        assert_eq!(memo.updated_at, "20");
    }
}

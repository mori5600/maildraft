use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablePreset {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub values: BTreeMap<String, String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablePresetInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub values: BTreeMap<String, String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl VariablePreset {
    pub fn new(input: VariablePresetInput, timestamp: &str) -> Self {
        Self {
            id: input.id,
            name: input.name,
            values: input.values,
            tags: input.tags,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
            last_used_at: None,
        }
    }

    pub fn update(&mut self, input: VariablePresetInput, timestamp: &str) {
        self.name = input.name;
        self.values = input.values;
        self.tags = input.tags;
        self.updated_at = timestamp.to_string();
    }

    pub fn mark_used(&mut self, timestamp: &str) {
        self.last_used_at = Some(timestamp.to_string());
        self.updated_at = timestamp.to_string();
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use pretty_assertions::assert_eq;

    use super::{VariablePreset, VariablePresetInput};

    #[test]
    fn variable_preset_new_and_update_replace_name_and_values() {
        let mut preset = VariablePreset::new(
            VariablePresetInput {
                id: "preset-1".to_string(),
                name: "A社向け".to_string(),
                values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
                tags: vec!["社外".to_string()],
            },
            "10",
        );

        assert_eq!(preset.created_at, "10");
        assert_eq!(preset.updated_at, "10");
        assert_eq!(preset.values["会社名"], "株式会社〇〇");
        assert_eq!(preset.tags, vec!["社外".to_string()]);
        assert_eq!(preset.last_used_at, None);

        preset.update(
            VariablePresetInput {
                id: "preset-1".to_string(),
                name: "B社向け".to_string(),
                values: BTreeMap::from([("担当者名".to_string(), "佐藤".to_string())]),
                tags: vec!["採用".to_string()],
            },
            "20",
        );

        assert_eq!(preset.name, "B社向け");
        assert_eq!(preset.updated_at, "20");
        assert_eq!(preset.values.get("会社名"), None);
        assert_eq!(preset.values["担当者名"], "佐藤");
        assert_eq!(preset.tags, vec!["採用".to_string()]);
    }

    #[test]
    fn variable_preset_mark_used_sets_last_used_timestamp() {
        let mut preset = VariablePreset::new(
            VariablePresetInput {
                id: "preset-1".to_string(),
                name: "A社向け".to_string(),
                values: BTreeMap::new(),
                tags: Vec::new(),
            },
            "10",
        );

        preset.mark_used("30");

        assert_eq!(preset.last_used_at.as_deref(), Some("30"));
        assert_eq!(preset.updated_at, "30");
    }
}

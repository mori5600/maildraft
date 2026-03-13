use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablePreset {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub values: BTreeMap<String, String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariablePresetInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub values: BTreeMap<String, String>,
}

impl VariablePreset {
    pub fn new(input: VariablePresetInput, timestamp: &str) -> Self {
        Self {
            id: input.id,
            name: input.name,
            values: input.values,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        }
    }

    pub fn update(&mut self, input: VariablePresetInput, timestamp: &str) {
        self.name = input.name;
        self.values = input.values;
        self.updated_at = timestamp.to_string();
    }
}

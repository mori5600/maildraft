use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum LoggingMode {
    Off,
    #[default]
    ErrorsOnly,
    Standard,
}

impl LoggingMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::ErrorsOnly => "errors_only",
            Self::Standard => "standard",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingSettings {
    pub mode: LoggingMode,
    pub retention_days: u16,
}

impl Default for LoggingSettings {
    fn default() -> Self {
        Self {
            mode: LoggingMode::ErrorsOnly,
            retention_days: 14,
        }
    }
}

impl LoggingSettings {
    /// Retention days outside the supported set collapse to 14.
    pub fn normalized(mut self) -> Self {
        self.retention_days = match self.retention_days {
            7 | 14 | 30 => self.retention_days,
            _ => 14,
        };
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProofreadingSettings {
    #[serde(default)]
    pub disabled_rule_ids: Vec<String>,
}

impl ProofreadingSettings {
    pub fn normalized(mut self) -> Self {
        self.disabled_rule_ids = normalize_rule_ids(self.disabled_rule_ids);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub logging: LoggingSettings,
    #[serde(default)]
    pub proofreading: ProofreadingSettings,
}

impl AppSettings {
    pub fn normalized(mut self) -> Self {
        self.logging = self.logging.normalized();
        self.proofreading = self.proofreading.normalized();
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingSettingsInput {
    pub mode: LoggingMode,
    pub retention_days: u16,
}

impl LoggingSettingsInput {
    /// Frontend input uses the same shape but still needs backend normalization.
    pub fn into_settings(self) -> LoggingSettings {
        LoggingSettings {
            mode: self.mode,
            retention_days: self.retention_days,
        }
        .normalized()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingSettingsSnapshot {
    pub mode: LoggingMode,
    pub retention_days: u16,
    pub directory_path: String,
    pub total_bytes: u64,
    pub file_count: usize,
    pub max_file_size_bytes: u64,
    pub max_rotated_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofreadingSettingsInput {
    pub disabled_rule_ids: Vec<String>,
}

impl ProofreadingSettingsInput {
    pub fn into_settings(self) -> ProofreadingSettings {
        ProofreadingSettings {
            disabled_rule_ids: self.disabled_rule_ids,
        }
        .normalized()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofreadingSettingsSnapshot {
    pub disabled_rule_ids: Vec<String>,
}

impl From<&ProofreadingSettings> for ProofreadingSettingsSnapshot {
    fn from(settings: &ProofreadingSettings) -> Self {
        Self {
            disabled_rule_ids: settings.disabled_rule_ids.clone(),
        }
    }
}

fn normalize_rule_ids(rule_ids: Vec<String>) -> Vec<String> {
    rule_ids
        .into_iter()
        .map(|rule_id| rule_id.trim().to_string())
        .filter(|rule_id| !rule_id.is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{
        AppSettings, LoggingMode, LoggingSettings, LoggingSettingsInput, ProofreadingSettings,
        ProofreadingSettingsInput,
    };

    #[test]
    fn logging_settings_normalized_limits_retention_days() {
        assert_eq!(
            LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 99,
            }
            .normalized()
            .retention_days,
            14
        );

        assert_eq!(
            LoggingSettings {
                mode: LoggingMode::ErrorsOnly,
                retention_days: 30,
            }
            .normalized()
            .retention_days,
            30
        );
    }

    #[test]
    fn input_and_app_settings_normalize_nested_logging_values() {
        let settings = LoggingSettingsInput {
            mode: LoggingMode::Off,
            retention_days: 1,
        }
        .into_settings();
        assert_eq!(settings.mode, LoggingMode::Off);
        assert_eq!(settings.retention_days, 14);

        let app_settings = AppSettings {
            logging: LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 3,
            },
            proofreading: ProofreadingSettings {
                disabled_rule_ids: vec![
                    " whitespace.trailing ".to_string(),
                    "".to_string(),
                    "whitespace.trailing".to_string(),
                    "prh".to_string(),
                ],
            },
        }
        .normalized();
        assert_eq!(app_settings.logging.retention_days, 14);
        assert_eq!(
            app_settings.proofreading.disabled_rule_ids,
            vec!["prh".to_string(), "whitespace.trailing".to_string()]
        );
    }

    #[test]
    fn proofreading_settings_normalize_rule_ids() {
        let settings = ProofreadingSettingsInput {
            disabled_rule_ids: vec![
                " ".to_string(),
                " prh ".to_string(),
                "whitespace.trailing".to_string(),
                "prh".to_string(),
            ],
        }
        .into_settings();

        assert_eq!(
            settings.disabled_rule_ids,
            vec!["prh".to_string(), "whitespace.trailing".to_string()]
        );
    }
}

use serde::{Deserialize, Serialize};

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
pub struct AppSettings {
    #[serde(default)]
    pub logging: LoggingSettings,
}

impl AppSettings {
    pub fn normalized(mut self) -> Self {
        self.logging = self.logging.normalized();
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

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{AppSettings, LoggingMode, LoggingSettings, LoggingSettingsInput};

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
        }
        .normalized();
        assert_eq!(app_settings.logging.retention_days, 14);
    }
}

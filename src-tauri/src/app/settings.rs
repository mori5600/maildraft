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

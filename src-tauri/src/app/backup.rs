use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::{
    app::settings::{AppSettings, LoggingSettingsSnapshot},
    modules::store::StoreSnapshot,
};

pub const BACKUP_DOCUMENT_APP: &str = "maildraft";
pub const BACKUP_DOCUMENT_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDocument {
    pub app: String,
    pub version: u8,
    pub exported_at_ms: u128,
    pub snapshot: StoreSnapshot,
    #[serde(default)]
    pub settings: AppSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedBackupSnapshot {
    pub snapshot: StoreSnapshot,
    pub logging_settings: LoggingSettingsSnapshot,
}

impl BackupDocument {
    pub fn from_state(snapshot: StoreSnapshot, settings: AppSettings) -> Self {
        Self {
            app: BACKUP_DOCUMENT_APP.to_string(),
            version: BACKUP_DOCUMENT_VERSION,
            exported_at_ms: now_unix_millis(),
            snapshot,
            settings,
        }
    }

    pub fn into_state(self) -> Result<(StoreSnapshot, AppSettings), String> {
        if self.app != BACKUP_DOCUMENT_APP {
            return Err("MailDraft のバックアップファイルではありません。".to_string());
        }

        if self.version != BACKUP_DOCUMENT_VERSION {
            return Err("このバックアップ形式には対応していません。".to_string());
        }

        Ok((self.snapshot, self.settings.normalized()))
    }
}

fn now_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

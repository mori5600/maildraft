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

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{BackupDocument, BACKUP_DOCUMENT_APP, BACKUP_DOCUMENT_VERSION};
    use crate::app::settings::{AppSettings, LoggingMode, LoggingSettings};
    use crate::modules::store::StoreSnapshot;

    #[test]
    fn backup_document_round_trips_and_normalizes_settings() {
        let snapshot = StoreSnapshot::seeded();
        let document = BackupDocument::from_state(
            snapshot.clone(),
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 99,
                },
            },
        );

        let (restored_snapshot, restored_settings) = document.into_state().unwrap();

        assert_eq!(restored_snapshot.drafts.len(), snapshot.drafts.len());
        assert_eq!(restored_settings.logging.mode, LoggingMode::Standard);
        assert_eq!(restored_settings.logging.retention_days, 14);
    }

    #[test]
    fn backup_document_rejects_other_apps_and_versions() {
        let err = BackupDocument {
            app: "other-app".to_string(),
            version: BACKUP_DOCUMENT_VERSION,
            exported_at_ms: 0,
            snapshot: StoreSnapshot::seeded(),
            settings: AppSettings::default(),
        }
        .into_state()
        .unwrap_err();
        assert_eq!(err, "MailDraft のバックアップファイルではありません。");

        let err = BackupDocument {
            app: BACKUP_DOCUMENT_APP.to_string(),
            version: BACKUP_DOCUMENT_VERSION + 1,
            exported_at_ms: 0,
            snapshot: StoreSnapshot::seeded(),
            settings: AppSettings::default(),
        }
        .into_state()
        .unwrap_err();
        assert_eq!(err, "このバックアップ形式には対応していません。");
    }
}

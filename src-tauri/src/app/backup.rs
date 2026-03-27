use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    app::settings::{
        AppSettings, EditorSettingsSnapshot, LoggingSettingsSnapshot, ProofreadingSettingsSnapshot,
    },
    app::storage::STORAGE_DOCUMENT_APP,
    modules::store::StoreSnapshot,
};

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
    pub editor_settings: EditorSettingsSnapshot,
    pub logging_settings: LoggingSettingsSnapshot,
    pub proofreading_settings: ProofreadingSettingsSnapshot,
}

impl BackupDocument {
    pub fn from_state(snapshot: StoreSnapshot, settings: AppSettings) -> Self {
        Self {
            app: STORAGE_DOCUMENT_APP.to_string(),
            version: BACKUP_DOCUMENT_VERSION,
            exported_at_ms: now_unix_millis(),
            snapshot,
            settings,
        }
    }

    /// Converts an imported backup into runtime state.
    ///
    /// Import normalizes embedded settings so older backups pick up current bounds.
    ///
    /// # Errors
    ///
    /// Returns an error if the document was not exported by this app.
    pub fn into_state(self) -> Result<(StoreSnapshot, AppSettings), String> {
        if self.app != STORAGE_DOCUMENT_APP {
            return Err("MailDraft のバックアップファイルではありません。".to_string());
        }

        Ok((self.snapshot, self.settings.normalized()))
    }
}

/// Decodes a backup document only when its schema version matches the current importer.
///
/// # Errors
///
/// Returns an error if the payload is not valid JSON or if the version is unsupported.
pub fn decode_backup_document(content: &str) -> Result<BackupDocument, String> {
    let raw = serde_json::from_str::<Value>(content).map_err(|error| error.to_string())?;
    let version = raw
        .as_object()
        .and_then(|object| object.get("version"))
        .and_then(Value::as_u64)
        .ok_or_else(|| "このバックアップ形式には対応していません。".to_string())?;

    match version as u8 {
        BACKUP_DOCUMENT_VERSION => {
            serde_json::from_value::<BackupDocument>(raw).map_err(|error| error.to_string())
        }
        _ => Err("このバックアップ形式には対応していません。".to_string()),
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

    use super::{decode_backup_document, BackupDocument, BACKUP_DOCUMENT_VERSION};
    use crate::app::settings::{
        AppSettings, EditorIndentStyle, EditorSettings, LoggingMode, LoggingSettings,
        ProofreadingSettings,
    };
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
                editor: EditorSettings {
                    indent_style: EditorIndentStyle::Tabs,
                    tab_size: 0,
                },
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec![" whitespace.trailing ".to_string(), "prh".to_string()],
                },
            },
        );

        let (restored_snapshot, restored_settings) = document.into_state().unwrap();

        assert_eq!(restored_snapshot.drafts.len(), snapshot.drafts.len());
        assert_eq!(restored_settings.logging.mode, LoggingMode::Standard);
        assert_eq!(restored_settings.logging.retention_days, 14);
        assert_eq!(
            restored_settings.editor.indent_style,
            EditorIndentStyle::Tabs
        );
        assert_eq!(restored_settings.editor.tab_size, 2);
        assert_eq!(
            restored_settings.proofreading.disabled_rule_ids,
            vec!["prh".to_string(), "whitespace.trailing".to_string()]
        );
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

        let err = decode_backup_document(
            &serde_json::to_string(&BackupDocument {
                app: crate::app::storage::STORAGE_DOCUMENT_APP.to_string(),
                version: BACKUP_DOCUMENT_VERSION + 1,
                exported_at_ms: 0,
                snapshot: StoreSnapshot::seeded(),
                settings: AppSettings::default(),
            })
            .unwrap(),
        )
        .unwrap_err();
        assert_eq!(err, "このバックアップ形式には対応していません。");
    }

    #[test]
    fn backup_document_decoder_accepts_current_version() {
        let decoded = decode_backup_document(
            &serde_json::to_string(&BackupDocument {
                app: crate::app::storage::STORAGE_DOCUMENT_APP.to_string(),
                version: BACKUP_DOCUMENT_VERSION,
                exported_at_ms: 0,
                snapshot: StoreSnapshot::seeded(),
                settings: AppSettings::default(),
            })
            .unwrap(),
        )
        .unwrap();

        assert_eq!(decoded.version, BACKUP_DOCUMENT_VERSION);
    }

    #[test]
    fn backup_document_decoder_defaults_missing_settings_field() {
        let decoded = decode_backup_document(
            &serde_json::json!({
                "app": crate::app::storage::STORAGE_DOCUMENT_APP,
                "version": BACKUP_DOCUMENT_VERSION,
                "exportedAtMs": 0,
                "snapshot": StoreSnapshot::seeded(),
            })
            .to_string(),
        )
        .expect("decode backup");

        let (_snapshot, settings) = decoded.into_state().expect("into state");
        assert_eq!(settings.logging.mode, LoggingMode::ErrorsOnly);
        assert_eq!(settings.logging.retention_days, 14);
        assert_eq!(settings.editor.indent_style, EditorIndentStyle::Spaces);
        assert_eq!(settings.editor.tab_size, 2);
        assert!(settings.proofreading.disabled_rule_ids.is_empty());
    }

    #[test]
    fn backup_document_decoder_rejects_missing_version_and_non_object_payloads() {
        assert_eq!(
            decode_backup_document("{\"app\":\"maildraft\"}").unwrap_err(),
            "このバックアップ形式には対応していません。"
        );
        assert!(!decode_backup_document("[1,2,3]").unwrap_err().is_empty());
    }
}

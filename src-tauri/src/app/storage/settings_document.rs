use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::app::settings::AppSettings;

use super::{now_unix_millis, AppResult, STORAGE_DOCUMENT_APP};

const SETTINGS_DOCUMENT_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsDocumentV1 {
    app: String,
    version: u8,
    saved_at_ms: u128,
    settings: AppSettings,
}

pub(super) fn decode_settings(content: &str) -> AppResult<AppSettings> {
    let raw = serde_json::from_str::<Value>(content).map_err(|error| error.to_string())?;
    let Some(object) = raw.as_object() else {
        return Err("設定ファイルの形式が正しくありません。".to_string());
    };

    if object.contains_key("version") || object.contains_key("settings") {
        let document =
            serde_json::from_value::<SettingsDocumentV1>(raw).map_err(|error| error.to_string())?;

        if document.app != STORAGE_DOCUMENT_APP {
            return Err("MailDraft の設定ファイルではありません。".to_string());
        }

        if document.version != SETTINGS_DOCUMENT_VERSION {
            return Err("この設定形式には対応していません。".to_string());
        }

        return Ok(document.settings.normalized());
    }

    serde_json::from_value::<AppSettings>(Value::Object(object.clone()))
        .map(AppSettings::normalized)
        .map_err(|error| error.to_string())
}

pub(super) fn encode_settings(settings: &AppSettings) -> AppResult<String> {
    serde_json::to_string_pretty(&SettingsDocumentV1 {
        app: STORAGE_DOCUMENT_APP.to_string(),
        version: SETTINGS_DOCUMENT_VERSION,
        saved_at_ms: now_unix_millis(),
        settings: settings.clone().normalized(),
    })
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::{decode_settings, encode_settings, SETTINGS_DOCUMENT_VERSION};
    use crate::app::settings::{AppSettings, LoggingMode, LoggingSettings};

    #[test]
    fn decode_settings_accepts_current_and_legacy_documents() {
        let current = decode_settings(
            &json!({
                "app": crate::app::storage::STORAGE_DOCUMENT_APP,
                "version": SETTINGS_DOCUMENT_VERSION,
                "savedAtMs": 0,
                "settings": {
                    "logging": {
                        "mode": "standard",
                        "retentionDays": 30,
                    }
                }
            })
            .to_string(),
        )
        .expect("decode current settings");
        assert_eq!(current.logging.mode, LoggingMode::Standard);
        assert_eq!(current.logging.retention_days, 30);

        let legacy = decode_settings(
            &json!({
                "logging": {
                    "mode": "off",
                    "retentionDays": 99,
                }
            })
            .to_string(),
        )
        .expect("decode legacy settings");
        assert_eq!(legacy.logging.mode, LoggingMode::Off);
        assert_eq!(legacy.logging.retention_days, 14);
    }

    #[test]
    fn decode_settings_rejects_foreign_apps_future_versions_and_non_objects() {
        assert_eq!(
            decode_settings("[1,2,3]").unwrap_err(),
            "設定ファイルの形式が正しくありません。"
        );
        assert_eq!(
            decode_settings(
                &json!({
                    "app": "other-app",
                    "version": SETTINGS_DOCUMENT_VERSION,
                    "savedAtMs": 0,
                    "settings": {},
                })
                .to_string(),
            )
            .unwrap_err(),
            "MailDraft の設定ファイルではありません。"
        );
        assert_eq!(
            decode_settings(
                &json!({
                    "app": crate::app::storage::STORAGE_DOCUMENT_APP,
                    "version": SETTINGS_DOCUMENT_VERSION + 1,
                    "savedAtMs": 0,
                    "settings": {},
                })
                .to_string(),
            )
            .unwrap_err(),
            "この設定形式には対応していません。"
        );
    }

    #[test]
    fn encode_settings_normalizes_and_wraps_document_metadata() {
        let encoded = encode_settings(&AppSettings {
            logging: LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 99,
            },
        })
        .expect("encode settings");
        let decoded: serde_json::Value = serde_json::from_str(&encoded).expect("decode json");

        assert_eq!(decoded["app"], json!("maildraft"));
        assert_eq!(decoded["version"], json!(SETTINGS_DOCUMENT_VERSION));
        assert_eq!(decoded["settings"]["logging"]["retentionDays"], json!(14));
    }
}

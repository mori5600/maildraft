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

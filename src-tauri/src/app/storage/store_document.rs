use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::modules::store::StoreSnapshot;

use super::{now_unix_millis, AppResult, STORAGE_DOCUMENT_APP};

const STORE_DOCUMENT_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoreDocumentV1 {
    app: String,
    version: u8,
    saved_at_ms: u128,
    snapshot: StoreSnapshot,
}

pub(super) fn decode_store_snapshot(content: &str) -> AppResult<StoreSnapshot> {
    let raw = serde_json::from_str::<Value>(content).map_err(|error| error.to_string())?;
    let Some(object) = raw.as_object() else {
        return Err("保存ファイルの形式が正しくありません。".to_string());
    };

    if object.contains_key("version") || object.contains_key("snapshot") {
        let document =
            serde_json::from_value::<StoreDocumentV1>(raw).map_err(|error| error.to_string())?;

        if document.app != STORAGE_DOCUMENT_APP {
            return Err("MailDraft の保存ファイルではありません。".to_string());
        }

        if document.version != STORE_DOCUMENT_VERSION {
            return Err("この保存形式には対応していません。".to_string());
        }

        return Ok(document.snapshot);
    }

    serde_json::from_value::<StoreSnapshot>(Value::Object(object.clone()))
        .map_err(|error| error.to_string())
}

pub(super) fn encode_store_snapshot(snapshot: &StoreSnapshot) -> AppResult<String> {
    serde_json::to_string_pretty(&StoreDocumentV1 {
        app: STORAGE_DOCUMENT_APP.to_string(),
        version: STORE_DOCUMENT_VERSION,
        saved_at_ms: now_unix_millis(),
        snapshot: snapshot.clone(),
    })
    .map_err(|error| error.to_string())
}

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::modules::store::StoreSnapshot;

use super::{paths::now_unix_millis, AppResult, STORAGE_DOCUMENT_APP};

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

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::{decode_store_snapshot, encode_store_snapshot, STORE_DOCUMENT_VERSION};
    use crate::modules::store::StoreSnapshot;

    #[test]
    fn decode_store_snapshot_accepts_current_and_legacy_documents() {
        let current = decode_store_snapshot(
            &json!({
                "app": crate::app::storage::STORAGE_DOCUMENT_APP,
                "version": STORE_DOCUMENT_VERSION,
                "savedAtMs": 0,
                "snapshot": StoreSnapshot::seeded(),
            })
            .to_string(),
        )
        .expect("decode current snapshot");
        assert_eq!(current.drafts[0].id, "draft-welcome");

        let legacy = decode_store_snapshot(
            &serde_json::to_string(&StoreSnapshot::seeded()).expect("serialize legacy snapshot"),
        )
        .expect("decode legacy snapshot");
        assert_eq!(legacy.templates[0].id, "template-thanks");
    }

    #[test]
    fn decode_store_snapshot_rejects_foreign_apps_future_versions_and_non_objects() {
        assert_eq!(
            decode_store_snapshot("[1,2,3]").unwrap_err(),
            "保存ファイルの形式が正しくありません。"
        );
        assert_eq!(
            decode_store_snapshot(
                &json!({
                    "app": "other-app",
                    "version": STORE_DOCUMENT_VERSION,
                    "savedAtMs": 0,
                    "snapshot": StoreSnapshot::seeded(),
                })
                .to_string(),
            )
            .unwrap_err(),
            "MailDraft の保存ファイルではありません。"
        );
        assert_eq!(
            decode_store_snapshot(
                &json!({
                    "app": crate::app::storage::STORAGE_DOCUMENT_APP,
                    "version": STORE_DOCUMENT_VERSION + 1,
                    "savedAtMs": 0,
                    "snapshot": StoreSnapshot::seeded(),
                })
                .to_string(),
            )
            .unwrap_err(),
            "この保存形式には対応していません。"
        );
    }

    #[test]
    fn encode_store_snapshot_wraps_snapshot_in_current_document_shape() {
        let encoded = encode_store_snapshot(&StoreSnapshot::seeded()).expect("encode store");
        let decoded: serde_json::Value = serde_json::from_str(&encoded).expect("decode json");

        assert_eq!(decoded["app"], json!("maildraft"));
        assert_eq!(decoded["version"], json!(STORE_DOCUMENT_VERSION));
        assert_eq!(
            decoded["snapshot"]["drafts"][0]["id"],
            json!("draft-welcome")
        );
    }
}

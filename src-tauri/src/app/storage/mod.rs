//! Storage helpers for MailDraft's JSON documents.
//!
//! Corrupt primary files fall back to backups, then to defaults.

mod atomic_write;
mod load;
mod paths;
mod settings_document;
mod store_document;
#[cfg(test)]
mod tests;
mod write;

use serde::Serialize;

type AppResult<T> = Result<T, String>;

#[cfg(test)]
pub use load::{load_app_settings, load_store_snapshot};
pub use load::{load_app_settings_with_status, load_store_snapshot_with_status};
pub use write::{write_app_settings, write_store_snapshot};

pub const STORAGE_DOCUMENT_APP: &str = "maildraft";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StartupNoticeTone {
    Notice,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupNoticeSnapshot {
    pub message: String,
    pub tone: StartupNoticeTone,
}

/// Carries a loaded value plus any startup notice caused by recovery.
pub struct LoadOutcome<T> {
    pub startup_notice: Option<StartupNoticeSnapshot>,
    pub value: T,
}

use std::{
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::app::settings::{LoggingMode, LoggingSettings, LoggingSettingsSnapshot};

pub const MAX_LOG_FILE_BYTES: u64 = 1_048_576;
pub const MAX_LOG_ROTATED_FILES: usize = 5;

pub struct AppLogger {
    logs_dir: PathBuf,
    session_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Error,
}

impl LogLevel {
    fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Error => "error",
        }
    }
}

pub struct LogEntry {
    pub level: LogLevel,
    pub event_name: &'static str,
    pub module: &'static str,
    pub result: &'static str,
    pub duration_ms: Option<u64>,
    pub error_code: Option<&'static str>,
    /// Stores redacted operational context only. Callers must keep user content and secrets out of this map.
    pub safe_context: Map<String, Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SerializedLogEntry<'a> {
    timestamp_ms: u128,
    level: &'a str,
    event_name: &'a str,
    module: &'a str,
    result: &'a str,
    session_id: &'a str,
    duration_ms: Option<u64>,
    error_code: Option<&'a str>,
    safe_context: &'a Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntrySnapshot {
    pub timestamp_ms: u128,
    pub level: String,
    pub event_name: String,
    pub module: String,
    pub result: String,
    pub session_id: String,
    pub duration_ms: Option<u64>,
    pub error_code: Option<String>,
    pub safe_context: Map<String, Value>,
}

impl AppLogger {
    pub fn new(logs_dir: PathBuf) -> Self {
        Self {
            logs_dir,
            session_id: build_session_id(),
        }
    }

    /// Appends one JSONL entry after enforcing retention and rotation.
    ///
    /// # Errors
    ///
    /// Returns an error if the logger cannot create the log directory, rotate files, or append the entry.
    pub fn record(&self, settings: &LoggingSettings, entry: LogEntry) -> Result<(), String> {
        if !should_record(settings, entry.level) {
            return Ok(());
        }

        fs::create_dir_all(&self.logs_dir).map_err(|error| error.to_string())?;
        self.prune_expired_logs(settings.retention_days)?;

        let serialized = SerializedLogEntry {
            timestamp_ms: now_unix_millis(),
            level: entry.level.as_str(),
            event_name: entry.event_name,
            module: entry.module,
            result: entry.result,
            session_id: &self.session_id,
            duration_ms: entry.duration_ms,
            error_code: entry.error_code,
            safe_context: &entry.safe_context,
        };

        let line = serde_json::to_string(&serialized).map_err(|error| error.to_string())?;
        self.rotate_if_needed(line.len() as u64 + 1)?;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.current_path())
            .map_err(|error| error.to_string())?;

        writeln!(file, "{line}").map_err(|error| error.to_string())
    }

    pub fn snapshot(&self, settings: &LoggingSettings) -> Result<LoggingSettingsSnapshot, String> {
        let (file_count, total_bytes) = collect_log_stats(&self.logs_dir)?;

        Ok(LoggingSettingsSnapshot {
            mode: settings.mode,
            retention_days: settings.retention_days,
            directory_path: self.logs_dir.display().to_string(),
            total_bytes,
            file_count,
            max_file_size_bytes: MAX_LOG_FILE_BYTES,
            max_rotated_files: MAX_LOG_ROTATED_FILES,
        })
    }

    pub fn load_recent(
        &self,
        retention_days: u16,
        limit: usize,
    ) -> Result<Vec<LogEntrySnapshot>, String> {
        if limit == 0 {
            return Ok(Vec::new());
        }

        self.prune_expired_logs(retention_days)?;

        if !self.logs_dir.exists() {
            return Ok(Vec::new());
        }

        let mut entries = Vec::new();

        for path in collect_log_paths(&self.logs_dir)? {
            let file = match fs::File::open(&path) {
                Ok(file) => file,
                Err(_) => continue,
            };
            let reader = BufReader::new(file);

            for line in reader.lines() {
                let Ok(line) = line else {
                    continue;
                };

                if line.trim().is_empty() {
                    continue;
                }

                if let Ok(entry) = serde_json::from_str::<LogEntrySnapshot>(&line) {
                    entries.push(entry);
                }
            }
        }

        entries.sort_by(|left, right| right.timestamp_ms.cmp(&left.timestamp_ms));
        entries.truncate(limit);

        Ok(entries)
    }

    pub fn clear(&self) -> Result<(), String> {
        if !self.logs_dir.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(&self.logs_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();

            if path.is_file() {
                fs::remove_file(path).map_err(|error| error.to_string())?;
            }
        }

        Ok(())
    }

    pub fn prune_expired_logs(&self, retention_days: u16) -> Result<(), String> {
        if !self.logs_dir.exists() {
            return Ok(());
        }

        let retention_window = Duration::from_secs(u64::from(retention_days) * 24 * 60 * 60);
        let cutoff = SystemTime::now()
            .checked_sub(retention_window)
            .unwrap_or(UNIX_EPOCH);

        for entry in fs::read_dir(&self.logs_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();

            if !path.is_file() {
                continue;
            }

            let Ok(metadata) = entry.metadata() else {
                continue;
            };
            let Ok(modified_at) = metadata.modified() else {
                continue;
            };

            if modified_at < cutoff {
                fs::remove_file(path).map_err(|error| error.to_string())?;
            }
        }

        Ok(())
    }

    fn rotate_if_needed(&self, next_entry_bytes: u64) -> Result<(), String> {
        let current_path = self.current_path();
        let current_bytes = fs::metadata(&current_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);

        if current_bytes + next_entry_bytes <= MAX_LOG_FILE_BYTES {
            return Ok(());
        }

        let oldest_path = self.rotated_path(MAX_LOG_ROTATED_FILES);
        if oldest_path.exists() {
            fs::remove_file(oldest_path).map_err(|error| error.to_string())?;
        }

        for index in (1..MAX_LOG_ROTATED_FILES).rev() {
            let source = self.rotated_path(index);
            let destination = self.rotated_path(index + 1);

            if !source.exists() {
                continue;
            }

            if destination.exists() {
                fs::remove_file(&destination).map_err(|error| error.to_string())?;
            }

            fs::rename(source, destination).map_err(|error| error.to_string())?;
        }

        if current_path.exists() {
            let destination = self.rotated_path(1);
            if destination.exists() {
                fs::remove_file(&destination).map_err(|error| error.to_string())?;
            }

            fs::rename(current_path, destination).map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    fn current_path(&self) -> PathBuf {
        self.logs_dir.join("current.jsonl")
    }

    fn rotated_path(&self, index: usize) -> PathBuf {
        self.logs_dir.join(format!("current.{index}.jsonl"))
    }
}

fn build_session_id() -> String {
    format!("sess-{:x}-{}", now_unix_millis(), std::process::id())
}

fn should_record(settings: &LoggingSettings, level: LogLevel) -> bool {
    match settings.mode {
        LoggingMode::Off => false,
        LoggingMode::ErrorsOnly => matches!(level, LogLevel::Error),
        LoggingMode::Standard => true,
    }
}

fn now_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn collect_log_stats(logs_dir: &Path) -> Result<(usize, u64), String> {
    if !logs_dir.exists() {
        return Ok((0, 0));
    }

    let mut file_count = 0;
    let mut total_bytes = 0;

    for entry in fs::read_dir(logs_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        file_count += 1;
        total_bytes += metadata.len();
    }

    Ok((file_count, total_bytes))
}

fn collect_log_paths(logs_dir: &Path) -> Result<Vec<PathBuf>, String> {
    if !logs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut paths = Vec::new();

    for entry in fs::read_dir(logs_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        if path.extension().and_then(|extension| extension.to_str()) == Some("jsonl") {
            paths.push(path);
        }
    }

    paths.sort();

    Ok(paths)
}

#[cfg(test)]
mod tests {
    use std::{fs, thread, time::Duration};

    use pretty_assertions::assert_eq;
    use serde_json::json;
    use serde_json::Map;
    use tempfile::tempdir;

    use super::{AppLogger, LogEntry, LogLevel, MAX_LOG_FILE_BYTES, MAX_LOG_ROTATED_FILES};
    use crate::app::settings::{LoggingMode, LoggingSettings};

    #[test]
    fn record_skips_info_entries_when_mode_is_errors_only() {
        let temp_dir = tempdir().unwrap();
        let logger = AppLogger::new(temp_dir.path().join("logs"));

        logger
            .record(
                &LoggingSettings {
                    mode: LoggingMode::ErrorsOnly,
                    retention_days: 14,
                },
                LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.save",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(12),
                    error_code: None,
                    safe_context: Map::new(),
                },
            )
            .unwrap();

        let snapshot = logger
            .snapshot(&LoggingSettings {
                mode: LoggingMode::ErrorsOnly,
                retention_days: 14,
            })
            .unwrap();

        assert_eq!(snapshot.file_count, 0);
        assert_eq!(snapshot.total_bytes, 0);
    }

    #[test]
    fn record_and_load_recent_returns_latest_entries_first() {
        let temp_dir = tempdir().unwrap();
        let logger = AppLogger::new(temp_dir.path().join("logs"));
        let settings = LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 14,
        };

        logger
            .record(
                &settings,
                LogEntry {
                    level: LogLevel::Info,
                    event_name: "draft.save",
                    module: "drafts",
                    result: "success",
                    duration_ms: Some(10),
                    error_code: None,
                    safe_context: Map::new(),
                },
            )
            .unwrap();
        thread::sleep(Duration::from_millis(2));
        logger
            .record(
                &settings,
                LogEntry {
                    level: LogLevel::Error,
                    event_name: "draft.restore_history",
                    module: "drafts",
                    result: "failure",
                    duration_ms: Some(22),
                    error_code: Some("DRAFT_HISTORY_NOT_FOUND"),
                    safe_context: Map::new(),
                },
            )
            .unwrap();

        let entries = logger.load_recent(14, 10).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].event_name, "draft.restore_history");
        assert_eq!(entries[1].event_name, "draft.save");
    }

    #[test]
    fn clear_removes_existing_log_files() {
        let temp_dir = tempdir().unwrap();
        let logger = AppLogger::new(temp_dir.path().join("logs"));
        let settings = LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 14,
        };

        logger
            .record(
                &settings,
                LogEntry {
                    level: LogLevel::Info,
                    event_name: "template.save",
                    module: "templates",
                    result: "success",
                    duration_ms: Some(8),
                    error_code: None,
                    safe_context: Map::new(),
                },
            )
            .unwrap();

        logger.clear().unwrap();
        let snapshot = logger.snapshot(&settings).unwrap();

        assert_eq!(snapshot.file_count, 0);
        assert_eq!(snapshot.total_bytes, 0);
    }

    #[test]
    fn clear_removes_only_files_and_preserves_subdirectories() {
        let temp_dir = tempdir().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        let archive_dir = logs_dir.join("archive");
        fs::create_dir_all(&archive_dir).unwrap();
        fs::write(logs_dir.join("current.jsonl"), "active log").unwrap();
        fs::write(archive_dir.join("keep.txt"), "do not delete").unwrap();

        let logger = AppLogger::new(logs_dir.clone());
        logger.clear().unwrap();

        assert!(!logs_dir.join("current.jsonl").exists());
        assert!(archive_dir.exists());
        assert!(archive_dir.join("keep.txt").exists());
    }

    #[test]
    fn load_recent_ignores_invalid_lines_and_non_jsonl_files() {
        let temp_dir = tempdir().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();
        fs::write(
            logs_dir.join("current.jsonl"),
            format!(
                "{}\nnot-json\n\n",
                json!({
                    "timestampMs": 10,
                    "level": "info",
                    "eventName": "draft.save",
                    "module": "drafts",
                    "result": "success",
                    "sessionId": "session-1",
                    "durationMs": 5,
                    "errorCode": null,
                    "safeContext": {},
                })
            ),
        )
        .unwrap();
        fs::write(
            logs_dir.join("notes.txt"),
            json!({
                "timestampMs": 11,
                "level": "error",
                "eventName": "ignored",
                "module": "drafts",
                "result": "failure",
                "sessionId": "session-2",
                "durationMs": 1,
                "errorCode": "ERR",
                "safeContext": {},
            })
            .to_string(),
        )
        .unwrap();

        let logger = AppLogger::new(logs_dir);
        let entries = logger.load_recent(14, 10).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].event_name, "draft.save");
    }

    #[test]
    fn load_recent_returns_empty_when_limit_is_zero() {
        let temp_dir = tempdir().unwrap();
        let logger = AppLogger::new(temp_dir.path().join("logs"));

        assert!(logger.load_recent(14, 0).unwrap().is_empty());
    }

    #[test]
    fn record_rotates_current_file_and_keeps_backup_count_bounded() {
        let temp_dir = tempdir().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();
        fs::write(
            logs_dir.join("current.jsonl"),
            vec![b'a'; MAX_LOG_FILE_BYTES as usize],
        )
        .unwrap();
        for index in 1..=MAX_LOG_ROTATED_FILES {
            fs::write(
                logs_dir.join(format!("current.{index}.jsonl")),
                format!("old-{index}"),
            )
            .unwrap();
        }

        let logger = AppLogger::new(logs_dir.clone());
        let settings = LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 14,
        };

        logger
            .record(
                &settings,
                LogEntry {
                    level: LogLevel::Info,
                    event_name: "memo.save",
                    module: "memo",
                    result: "success",
                    duration_ms: Some(3),
                    error_code: None,
                    safe_context: Map::new(),
                },
            )
            .unwrap();

        let rotated = fs::read(logs_dir.join("current.1.jsonl")).unwrap();
        assert_eq!(rotated.len(), MAX_LOG_FILE_BYTES as usize);
        assert!(logs_dir.join("current.5.jsonl").exists());
        assert!(!logs_dir.join("current.6.jsonl").exists());

        let snapshot = logger.snapshot(&settings).unwrap();
        assert_eq!(snapshot.file_count, MAX_LOG_ROTATED_FILES + 1);
    }

    #[test]
    fn snapshot_counts_only_log_files_and_ignores_subdirectories() {
        let temp_dir = tempdir().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        let archive_dir = logs_dir.join("archive");
        fs::create_dir_all(&archive_dir).unwrap();
        fs::write(logs_dir.join("current.jsonl"), "one").unwrap();
        fs::write(logs_dir.join("current.1.jsonl"), "two").unwrap();
        fs::write(archive_dir.join("nested.jsonl"), "nested").unwrap();

        let logger = AppLogger::new(logs_dir);
        let snapshot = logger
            .snapshot(&LoggingSettings {
                mode: LoggingMode::Standard,
                retention_days: 14,
            })
            .unwrap();

        assert_eq!(snapshot.file_count, 2);
        assert_eq!(snapshot.total_bytes, 6);
    }

    #[test]
    fn prune_expired_logs_with_zero_retention_removes_existing_files() {
        let temp_dir = tempdir().unwrap();
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir_all(&logs_dir).unwrap();
        fs::write(logs_dir.join("current.jsonl"), "old log").unwrap();
        thread::sleep(Duration::from_millis(5));

        let logger = AppLogger::new(logs_dir.clone());
        logger.prune_expired_logs(0).unwrap();

        assert!(!logs_dir.join("current.jsonl").exists());
    }
}

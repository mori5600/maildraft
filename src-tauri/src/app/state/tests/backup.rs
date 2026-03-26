use super::*;

#[test]
fn logging_settings_and_backup_methods_round_trip_state() {
    let (state, directory) = make_state();

    state
        .save_template(TemplateInput {
            id: "template-exported".to_string(),
            name: "書き出し用".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "".to_string(),
            opening: "冒頭".to_string(),
            body: "本文".to_string(),
            closing: "末尾".to_string(),
            signature_id: Some("signature-default".to_string()),
        })
        .expect("save template");

    let settings_snapshot = state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .expect("save logging settings");
    assert_eq!(settings_snapshot.mode, LoggingMode::Standard);
    assert_eq!(settings_snapshot.retention_days, 30);
    let editor_snapshot = state
        .save_editor_settings(EditorSettingsInput {
            indent_style: EditorIndentStyle::Tabs,
            tab_size: 4,
        })
        .expect("save editor settings");
    assert_eq!(editor_snapshot.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(editor_snapshot.tab_size, 4);
    let proofreading_snapshot = state
        .save_proofreading_settings(ProofreadingSettingsInput {
            disabled_rule_ids: vec![" prh ".to_string(), "whitespace.trailing".to_string()],
        })
        .expect("save proofreading settings");
    assert_eq!(
        proofreading_snapshot.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let persisted_settings = read_settings_file(&settings_file_path(&state));
    assert_eq!(persisted_settings.logging.mode, LoggingMode::Standard);
    assert_eq!(persisted_settings.logging.retention_days, 30);
    assert_eq!(persisted_settings.editor.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(persisted_settings.editor.tab_size, 4);
    assert_eq!(
        persisted_settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    state.log_event_with_settings(
        &LoggingSettings {
            mode: LoggingMode::Standard,
            retention_days: 30,
        },
        LogEntry {
            level: LogLevel::Info,
            event_name: "tests.logging",
            module: "tests",
            result: "success",
            duration_ms: Some(5),
            error_code: None,
            safe_context: serde_json::Map::new(),
        },
    );

    let recent_logs = state.load_recent_logs(Some(5)).expect("recent logs");
    assert!(!recent_logs.is_empty());

    let cleared = state.clear_logs().expect("clear logs");
    assert_eq!(cleared.file_count, 0);

    let backup_path = directory.path().join("maildraft-backup.json");
    let exported_path = state
        .export_backup(backup_path.to_str().expect("backup path"))
        .expect("export backup");
    assert_eq!(exported_path, backup_path.display().to_string());

    let (import_state, _other_directory) = make_state();
    let imported = import_state
        .import_backup(backup_path.to_str().expect("backup path"))
        .expect("import backup");
    assert_eq!(imported.snapshot.templates.len(), 2);
    assert_eq!(imported.editor_settings.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(imported.editor_settings.tab_size, 4);
    assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
    assert_eq!(imported.logging_settings.retention_days, 30);
    assert_eq!(
        imported.proofreading_settings.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn runtime_backup_methods_round_trip_with_sqlite_repository() {
    let (state, directory) = make_runtime_state();

    state
        .save_template(TemplateInput {
            id: "template-runtime-exported".to_string(),
            name: "SQLite 書き出し".to_string(),
            is_pinned: true,
            subject: "件名".to_string(),
            recipient: "宛先".to_string(),
            opening: "冒頭".to_string(),
            body: "本文".to_string(),
            closing: "末尾".to_string(),
            signature_id: Some("signature-default".to_string()),
        })
        .expect("save template");
    state
        .save_memo(MemoInput {
            id: "memo-runtime-exported".to_string(),
            title: "SQLite メモ".to_string(),
            is_pinned: false,
            body: "本文".to_string(),
        })
        .expect("save memo");
    state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .expect("save logging settings");
    state
        .save_editor_settings(EditorSettingsInput {
            indent_style: EditorIndentStyle::Tabs,
            tab_size: 4,
        })
        .expect("save editor settings");
    state
        .save_proofreading_settings(ProofreadingSettingsInput {
            disabled_rule_ids: vec![" prh ".to_string(), "whitespace.trailing".to_string()],
        })
        .expect("save proofreading settings");

    let backup_path = directory.path().join("runtime-backup.json");
    state
        .export_backup(backup_path.to_str().expect("backup path"))
        .expect("export backup");

    let document = decode_backup_document(&fs::read_to_string(&backup_path).expect("read backup"))
        .expect("decode backup");
    assert!(document
        .snapshot
        .templates
        .iter()
        .any(|template| template.id == "template-runtime-exported"));
    assert!(document
        .snapshot
        .memos
        .iter()
        .any(|memo| memo.id == "memo-runtime-exported"));
    assert_eq!(document.settings.editor.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(document.settings.editor.tab_size, 4);
    assert_eq!(document.settings.logging.mode, LoggingMode::Standard);
    assert_eq!(document.settings.logging.retention_days, 30);
    assert_eq!(
        document.settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let (import_state, import_directory) = make_runtime_state();
    let imported = import_state
        .import_backup(backup_path.to_str().expect("backup path"))
        .expect("import backup");
    let import_db_path = runtime_database_path(import_directory.path());

    assert!(imported
        .snapshot
        .templates
        .iter()
        .any(|template| template.id == "template-runtime-exported"));
    assert!(imported
        .snapshot
        .memos
        .iter()
        .any(|memo| memo.id == "memo-runtime-exported"));
    assert_eq!(imported.editor_settings.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(imported.editor_settings.tab_size, 4);
    assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
    assert_eq!(imported.logging_settings.retention_days, 30);
    assert_eq!(
        imported.proofreading_settings.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );

    let persisted_store = read_sqlite_store(&import_db_path);
    let persisted_settings = read_sqlite_settings(&import_db_path);
    assert!(persisted_store
        .templates
        .iter()
        .any(|template| template.id == "template-runtime-exported"));
    assert!(persisted_store
        .memos
        .iter()
        .any(|memo| memo.id == "memo-runtime-exported"));
    assert_eq!(persisted_settings.editor.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(persisted_settings.editor.tab_size, 4);
    assert_eq!(persisted_settings.logging.mode, LoggingMode::Standard);
    assert_eq!(persisted_settings.logging.retention_days, 30);
    assert_eq!(
        persisted_settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn runtime_export_backup_reads_persisted_sqlite_state_instead_of_unsaved_memory() {
    let (state, directory) = make_runtime_state();
    let db_path = runtime_database_path(directory.path());
    let export_path = directory.path().join("runtime-persisted-export.json");
    let persisted_store = read_sqlite_store(&db_path);
    let persisted_settings = read_sqlite_settings(&db_path);

    {
        let mut store = state.store.lock().expect("store lock");
        store.drafts[0].title = "unsaved runtime title".to_string();
        store.signatures[0].is_default = false;
    }
    {
        let mut settings = state.settings.lock().expect("settings lock");
        settings.logging.retention_days = 30;
        settings.proofreading.disabled_rule_ids = vec!["prh".to_string()];
    }

    state
        .export_backup(export_path.to_str().expect("export path"))
        .expect("export backup");

    let document = decode_backup_document(&fs::read_to_string(&export_path).expect("read backup"))
        .expect("decode backup");

    assert_eq!(
        serde_json::to_value(document.snapshot).expect("serialize document snapshot"),
        serde_json::to_value(persisted_store).expect("serialize persisted snapshot"),
    );
    assert_eq!(
        serde_json::to_value(document.settings).expect("serialize document settings"),
        serde_json::to_value(persisted_settings).expect("serialize persisted settings"),
    );
}

#[test]
fn import_backup_normalizes_snapshot_and_logging_settings_before_persisting() {
    let (state, directory) = make_state();
    let backup_path = directory.path().join("maildraft-normalized-backup.json");
    let mut snapshot = StoreSnapshot::seeded();
    snapshot.drafts[0].template_id = Some("missing-template".to_string());
    snapshot.drafts[0].signature_id = Some("missing-signature".to_string());
    snapshot.templates[0].signature_id = Some("missing-signature".to_string());
    snapshot.signatures[0].is_default = false;
    snapshot.memos = vec![
        Memo {
            id: "memo-1".to_string(),
            title: "older".to_string(),
            is_pinned: false,
            body: "older body".to_string(),
            created_at: "0".to_string(),
            updated_at: "10".to_string(),
        },
        Memo {
            id: "memo-1".to_string(),
            title: "newer".to_string(),
            is_pinned: false,
            body: "newer body".to_string(),
            created_at: "0".to_string(),
            updated_at: "20".to_string(),
        },
    ];

    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            snapshot,
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
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");

    let imported = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .expect("import backup");

    assert_eq!(imported.editor_settings.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(imported.editor_settings.tab_size, 2);
    assert_eq!(imported.logging_settings.mode, LoggingMode::Standard);
    assert_eq!(imported.logging_settings.retention_days, 14);
    assert_eq!(
        imported.proofreading_settings.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
    assert_eq!(imported.snapshot.drafts[0].template_id, None);
    assert_eq!(imported.snapshot.drafts[0].signature_id, None);
    assert_eq!(imported.snapshot.templates[0].signature_id, None);
    assert_eq!(
        imported
            .snapshot
            .signatures
            .iter()
            .filter(|signature| signature.is_default)
            .count(),
        1
    );
    assert_eq!(
        imported
            .snapshot
            .memos
            .iter()
            .map(|memo| memo.title.as_str())
            .collect::<Vec<_>>(),
        vec!["newer", "older"]
    );
    assert_eq!(
        imported
            .snapshot
            .memos
            .iter()
            .all(|memo| !memo.id.trim().is_empty()),
        true
    );
    assert_eq!(
        imported
            .snapshot
            .memos
            .iter()
            .map(|memo| memo.id.as_str())
            .collect::<std::collections::HashSet<_>>()
            .len(),
        2
    );

    let persisted_store = read_store(&store_file_path(&state));
    let persisted_settings = read_settings_file(&settings_file_path(&state));
    assert_eq!(persisted_store.drafts[0].template_id, None);
    assert_eq!(persisted_store.drafts[0].signature_id, None);
    assert_eq!(persisted_store.templates[0].signature_id, None);
    assert_eq!(persisted_settings.editor.indent_style, EditorIndentStyle::Tabs);
    assert_eq!(persisted_settings.editor.tab_size, 2);
    assert_eq!(persisted_settings.logging.retention_days, 14);
    assert_eq!(
        persisted_settings.proofreading.disabled_rule_ids,
        vec!["prh".to_string(), "whitespace.trailing".to_string()]
    );
}

#[test]
fn export_backup_reads_persisted_state_instead_of_unsaved_memory() {
    let (state, directory) = make_state();
    let export_path = directory.path().join("normalized-export.json");
    let persisted_store = read_store(&store_file_path(&state));
    let persisted_settings = read_settings_file(&settings_file_path(&state));

    {
        let mut store = state.store.lock().expect("store lock");
        store.drafts[0].title = "unsaved json title".to_string();
        store.signatures[0].is_default = false;
    }
    {
        let mut settings = state.settings.lock().expect("settings lock");
        settings.logging.retention_days = 30;
        settings.proofreading.disabled_rule_ids = vec![" prh ".to_string()];
    }

    state
        .export_backup(export_path.to_str().expect("export path"))
        .expect("export backup");

    let document = decode_backup_document(&fs::read_to_string(&export_path).expect("read backup"))
        .expect("decode backup");

    assert_eq!(
        serde_json::to_value(document.snapshot).expect("serialize document snapshot"),
        serde_json::to_value(persisted_store).expect("serialize persisted snapshot"),
    );
    assert_eq!(
        serde_json::to_value(document.settings).expect("serialize document settings"),
        serde_json::to_value(persisted_settings).expect("serialize persisted settings"),
    );
}

#[test]
fn failed_import_does_not_mutate_existing_store_or_settings() {
    let (state, directory) = make_state();

    state
        .save_memo(MemoInput {
            id: "memo-existing".to_string(),
            title: "既存メモ".to_string(),
            is_pinned: true,
            body: "既存本文".to_string(),
        })
        .expect("save memo");
    state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .expect("save logging settings");

    let before_store =
        serde_json::to_value(read_store(&store_file_path(&state))).expect("serialize store");
    let before_settings = serde_json::to_value(read_settings_file(&settings_file_path(&state)))
        .expect("serialize settings");
    let invalid_backup = directory.path().join("invalid-import.json");
    fs::write(&invalid_backup, "{\"version\":999}").expect("write invalid backup");

    assert_eq!(
        state
            .import_backup(invalid_backup.to_str().expect("invalid path"))
            .unwrap_err(),
        "このバックアップ形式には対応していません。"
    );

    let after_store =
        serde_json::to_value(read_store(&store_file_path(&state))).expect("serialize store");
    let after_settings = serde_json::to_value(read_settings_file(&settings_file_path(&state)))
        .expect("serialize settings");
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
}

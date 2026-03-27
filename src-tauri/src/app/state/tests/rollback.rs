use super::*;

#[test]
fn save_draft_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-store-path",
        |state| {
            state.save_draft(DraftInput {
                id: "draft-welcome".to_string(),
                title: "壊してはいけない下書き".to_string(),
                is_pinned: true,
                subject: "失敗した保存".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "この更新はロールバックされるべきです。".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                template_id: Some("template-thanks".to_string()),
                signature_id: Some("signature-default".to_string()),
                variable_values: BTreeMap::new(),
                tags: Vec::new(),
            })
        },
    );
}

#[test]
fn save_template_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-template-store-path",
        |state| {
            state.save_template(TemplateInput {
                id: "template-thanks".to_string(),
                name: "壊してはいけないテンプレート".to_string(),
                is_pinned: true,
                subject: "変更されるべきではない".to_string(),
                recipient: "株式会社〇〇".to_string(),
                opening: "お世話になっております。".to_string(),
                body: "ロールバックされる本文".to_string(),
                closing: "よろしくお願いいたします。".to_string(),
                signature_id: Some("signature-default".to_string()),
                tags: Vec::new(),
            })
        },
    );
}

#[test]
fn save_signature_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-signature-store-path",
        |state| {
            state.save_signature(SignatureInput {
                id: "signature-default".to_string(),
                name: "壊してはいけない署名".to_string(),
                is_pinned: true,
                body: "ロールバック対象".to_string(),
                is_default: false,
            })
        },
    );
}

#[test]
fn save_memo_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-memo-store-path",
        |state| {
            state.save_memo(MemoInput {
                id: "memo-rollback".to_string(),
                title: "新規メモ".to_string(),
                is_pinned: true,
                body: "保存失敗で残ってはいけない".to_string(),
                tags: Vec::new(),
            })
        },
    );
}

#[test]
fn save_variable_preset_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-preset-store-path",
        |state| {
            state.save_variable_preset(VariablePresetInput {
                id: "preset-rollback".to_string(),
                name: "新規セット".to_string(),
                values: BTreeMap::from([("会社名".to_string(), "株式会社〇〇".to_string())]),
            })
        },
    );
}

#[test]
fn delete_template_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-delete-template-path",
        |state| state.delete_template("template-thanks"),
    );
}

#[test]
fn delete_memo_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .save_memo(MemoInput {
            id: "memo-delete".to_string(),
            title: "削除対象".to_string(),
            is_pinned: false,
            body: "削除失敗で残るべき".to_string(),
            tags: Vec::new(),
        })
        .expect("save memo");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-delete-memo-path",
        |state| state.delete_memo("memo-delete"),
    );
}

#[test]
fn restore_draft_history_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .save_draft(DraftInput {
            id: "draft-welcome".to_string(),
            title: "履歴作成".to_string(),
            is_pinned: false,
            subject: "件名".to_string(),
            recipient: "株式会社〇〇".to_string(),
            opening: "お世話になっております。".to_string(),
            body: "変更後の本文".to_string(),
            closing: "よろしくお願いいたします。".to_string(),
            template_id: Some("template-thanks".to_string()),
            signature_id: Some("signature-default".to_string()),
            variable_values: BTreeMap::new(),
            tags: Vec::new(),
        })
        .expect("save draft");
    let history_id = state
        .load_snapshot()
        .expect("snapshot")
        .draft_history
        .first()
        .expect("history")
        .id
        .clone();
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-restore-history-path",
        |state| state.restore_draft_history("draft-welcome", &history_id),
    );
}

#[test]
fn restore_signature_from_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .delete_signature("signature-default")
        .expect("trash signature");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-restore-signature-path",
        |state| state.restore_signature_from_trash("signature-default"),
    );
}

#[test]
fn restore_memo_from_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .save_memo(MemoInput {
            id: "memo-restore".to_string(),
            title: "復元対象".to_string(),
            is_pinned: false,
            body: "復元失敗で残るべき".to_string(),
            tags: Vec::new(),
        })
        .expect("save memo");
    state.delete_memo("memo-restore").expect("trash memo");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-restore-memo-path",
        |state| state.restore_memo_from_trash("memo-restore"),
    );
}

#[test]
fn permanently_delete_signature_from_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    state
        .delete_signature("signature-default")
        .expect("trash signature");
    assert_store_operation_rolls_back_on_persist_failure(
        &mut state,
        directory.path(),
        "blocked-purge-signature-path",
        |state| state.permanently_delete_signature_from_trash("signature-default"),
    );
}

#[test]
fn empty_trash_rolls_back_when_store_persistence_fails() {
    let (mut state, directory) = make_state();
    let original_store_path = store_file_path(&state);

    state.delete_draft("draft-welcome").expect("trash draft");
    state
        .delete_template("template-thanks")
        .expect("trash template");

    let before_memory = serde_json::to_value(
        state
            .load_snapshot()
            .expect("snapshot before empty failure"),
    )
    .expect("serialize before");
    let before_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    let blocked_store_path = directory.path().join("blocked-empty-trash-path");
    fs::create_dir_all(&blocked_store_path).expect("create blocked store path");
    let settings_path = settings_file_path(&state);
    state.replace_json_repository_for_tests(blocked_store_path, settings_path);

    let error = state.empty_trash().unwrap_err();
    assert!(!error.is_empty());

    let after_memory =
        serde_json::to_value(state.load_snapshot().expect("snapshot after empty failure"))
            .expect("serialize after");
    let after_disk =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize persisted store");
    assert_eq!(after_memory, before_memory);
    assert_eq!(after_disk, before_disk);
}

#[test]
fn save_logging_settings_rolls_back_when_settings_persistence_fails() {
    let (mut state, directory) = make_state();
    let original_settings_path = settings_file_path(&state);
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");
    block_settings_persistence(&mut state, directory.path(), "blocked-settings-path");

    let error = state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .unwrap_err();
    assert!(!error.is_empty());

    let current_logging = state
        .load_logging_settings()
        .expect("logging settings after failure");
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    assert_eq!(current_logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(current_logging.retention_days, 14);
    assert_eq!(after_settings, before_settings);
}

#[test]
fn save_logging_settings_rolls_back_when_log_pruning_fails() {
    let (state, directory) = make_state();
    let state = state;
    let original_settings_path = settings_file_path(&state);
    let before_memory = settings_value(&state);
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");
    replace_logs_directory_with_file(directory.path());

    let error = state
        .save_logging_settings(LoggingSettingsInput {
            mode: LoggingMode::Standard,
            retention_days: 30,
        })
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = settings_value(&state);
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    assert_eq!(after_memory, before_memory);
    assert_eq!(after_settings, before_settings);
}

#[test]
fn import_backup_rolls_back_store_and_settings_when_settings_persistence_fails() {
    let (mut state, directory) = make_state();
    let original_store_path = store_file_path(&state);
    let original_settings_path = settings_file_path(&state);
    let before_memory = serde_json::to_value(
        state
            .load_snapshot()
            .expect("snapshot before import failure"),
    )
    .expect("serialize before");
    let before_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store before");
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");

    let mut imported_snapshot = StoreSnapshot::seeded();
    imported_snapshot.memos.push(Memo {
        id: "memo-imported".to_string(),
        title: "復元メモ".to_string(),
        is_pinned: true,
        body: "この内容は失敗時に残ってはいけません。".to_string(),
        tags: Vec::new(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    });
    let backup_path = directory.path().join("rollback-import.json");
    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            imported_snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
                editor: Default::default(),
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec!["prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");

    let blocked_settings_path = directory.path().join("blocked-import-settings-path");
    fs::create_dir_all(&blocked_settings_path).expect("create blocked settings path");
    let store_path = store_file_path(&state);
    state.replace_json_repository_for_tests(store_path, blocked_settings_path);

    let error = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = serde_json::to_value(
        state
            .load_snapshot()
            .expect("snapshot after import failure"),
    )
    .expect("serialize after");
    let after_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store after");
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    let current_logging = state
        .load_logging_settings()
        .expect("logging settings after failure");

    assert_eq!(after_memory, before_memory);
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
    assert_eq!(current_logging.mode, LoggingMode::ErrorsOnly);
    assert_eq!(current_logging.retention_days, 14);
}

#[test]
fn import_backup_rolls_back_store_and_settings_when_log_pruning_fails() {
    let (state, directory) = make_state();
    let state = state;
    let original_store_path = store_file_path(&state);
    let original_settings_path = settings_file_path(&state);
    let before_memory = snapshot_value(&state);
    let before_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store before");
    let before_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings before");

    let mut imported_snapshot = StoreSnapshot::seeded();
    imported_snapshot.memos.push(Memo {
        id: "memo-imported-log".to_string(),
        title: "復元メモ".to_string(),
        is_pinned: true,
        body: "この内容は log prune failure で残ってはいけません。".to_string(),
        tags: Vec::new(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    });
    let backup_path = directory.path().join("rollback-import-log.json");
    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            imported_snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
                editor: Default::default(),
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec!["prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");
    replace_logs_directory_with_file(directory.path());

    let error = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = snapshot_value(&state);
    let after_store =
        serde_json::to_value(read_store(&original_store_path)).expect("serialize store after");
    let after_settings = serde_json::to_value(read_settings_file(&original_settings_path))
        .expect("serialize settings after");
    let after_memory_settings = settings_value(&state);

    assert_eq!(after_memory, before_memory);
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
    assert_eq!(after_memory_settings, before_settings);
}

#[test]
fn runtime_import_backup_rolls_back_sqlite_state_when_log_pruning_fails() {
    let (state, directory) = make_runtime_state();
    let db_path = runtime_database_path(directory.path());
    let before_memory = snapshot_value(&state);
    let before_memory_settings = settings_value(&state);
    let before_store =
        serde_json::to_value(read_sqlite_store(&db_path)).expect("serialize store before");
    let before_settings =
        serde_json::to_value(read_sqlite_settings(&db_path)).expect("serialize settings before");

    let mut imported_snapshot = StoreSnapshot::seeded();
    imported_snapshot.memos.push(Memo {
        id: "memo-runtime-imported-log".to_string(),
        title: "復元メモ".to_string(),
        is_pinned: true,
        body: "この内容は log prune failure で残ってはいけません。".to_string(),
        tags: Vec::new(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    });
    let backup_path = directory.path().join("runtime-rollback-import-log.json");
    fs::write(
        &backup_path,
        serde_json::to_string(&BackupDocument::from_state(
            imported_snapshot,
            AppSettings {
                logging: LoggingSettings {
                    mode: LoggingMode::Standard,
                    retention_days: 30,
                },
                editor: Default::default(),
                proofreading: ProofreadingSettings {
                    disabled_rule_ids: vec!["prh".to_string()],
                },
            },
        ))
        .expect("serialize backup"),
    )
    .expect("write backup");
    replace_logs_directory_with_file(directory.path());

    let error = state
        .import_backup(backup_path.to_str().expect("backup path"))
        .unwrap_err();
    assert!(!error.is_empty());

    let after_memory = snapshot_value(&state);
    let after_memory_settings = settings_value(&state);
    let after_store =
        serde_json::to_value(read_sqlite_store(&db_path)).expect("serialize store after");
    let after_settings =
        serde_json::to_value(read_sqlite_settings(&db_path)).expect("serialize settings after");

    assert_eq!(after_memory, before_memory);
    assert_eq!(after_memory_settings, before_memory_settings);
    assert_eq!(after_store, before_store);
    assert_eq!(after_settings, before_settings);
}

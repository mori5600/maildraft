use super::*;

#[test]
fn load_recent_logs_and_clear_logs_report_corrupted_log_storage() {
    let (state, directory) = make_state();
    let before_settings = settings_value(&state);
    replace_logs_directory_with_file(directory.path());

    assert!(!state.load_logging_settings().unwrap_err().is_empty());
    assert!(!state.load_recent_logs(Some(10)).unwrap_err().is_empty());
    assert!(!state.clear_logs().unwrap_err().is_empty());
    assert_eq!(settings_value(&state), before_settings);
}

#[test]
fn missing_items_return_stable_errors_and_recent_logs_respect_limits() {
    let (state, _directory) = make_state();

    assert_eq!(
        state.delete_draft("missing").unwrap_err(),
        "指定した下書きが見つかりませんでした。"
    );
    assert_eq!(
        state
            .restore_draft_history("draft-welcome", "missing")
            .unwrap_err(),
        "指定した履歴が見つかりませんでした。"
    );
    assert_eq!(
        state.delete_template("missing").unwrap_err(),
        "指定したテンプレートが見つかりませんでした。"
    );
    assert_eq!(
        state.delete_signature("missing").unwrap_err(),
        "指定した署名が見つかりませんでした。"
    );
    assert_eq!(
        state.delete_memo("missing").unwrap_err(),
        "指定したメモが見つかりませんでした。"
    );
    assert_eq!(
        state.restore_draft_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state.restore_template_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state.restore_signature_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state.restore_memo_from_trash("missing").unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_draft_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_template_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_signature_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );
    assert_eq!(
        state
            .permanently_delete_memo_from_trash("missing")
            .unwrap_err(),
        "指定した項目がゴミ箱に見つかりませんでした。"
    );

    let logging_settings = LoggingSettings {
        mode: LoggingMode::Standard,
        retention_days: 30,
    };
    for index in 0..205 {
        state.log_event_with_settings(
            &logging_settings,
            LogEntry {
                level: LogLevel::Info,
                event_name: "tests.limit",
                module: "tests",
                result: "success",
                duration_ms: Some(index),
                error_code: None,
                safe_context: serde_json::Map::from_iter([("index".to_string(), json!(index))]),
            },
        );
    }

    assert_eq!(state.load_recent_logs(Some(0)).unwrap().len(), 1);
    assert_eq!(state.load_recent_logs(None).unwrap().len(), 80);
    assert_eq!(state.load_recent_logs(Some(999)).unwrap().len(), 200);
}

#[test]
fn backup_methods_propagate_export_and_import_failures() {
    let (state, directory) = make_state();

    let export_error = state
        .export_backup(directory.path().to_str().expect("directory path"))
        .unwrap_err();
    assert!(!export_error.is_empty());

    let invalid_backup = directory.path().join("invalid-backup.json");
    fs::write(
        &invalid_backup,
        serde_json::to_string(&json!({
            "app": "maildraft",
            "snapshot": {}
        }))
        .expect("serialize invalid backup"),
    )
    .expect("write invalid backup");

    assert_eq!(
        state
            .import_backup(invalid_backup.to_str().expect("invalid backup path"))
            .unwrap_err(),
        "このバックアップ形式には対応していません。"
    );
}

#[test]
fn backup_methods_validate_path_shape_and_size_limits() {
    let (state, directory) = make_state();

    assert_eq!(
        state.export_backup("relative-backup.json").unwrap_err(),
        "バックアップの書き出し先は絶対パスの .json ファイルを指定してください。"
    );

    let invalid_extension = directory.path().join("backup.txt");
    assert_eq!(
        state
            .export_backup(invalid_extension.to_str().expect("invalid extension path"))
            .unwrap_err(),
        "バックアップの書き出し先は絶対パスの .json ファイルを指定してください。"
    );

    let oversized_backup = directory.path().join("oversized-backup.json");
    let oversized_file = std::fs::File::create(&oversized_backup).expect("create oversized file");
    oversized_file
        .set_len(MAX_BACKUP_FILE_BYTES + 1)
        .expect("set oversized len");
    assert_eq!(
        state
            .import_backup(oversized_backup.to_str().expect("oversized backup path"))
            .unwrap_err(),
        "バックアップファイルが大きすぎます。"
    );
}

#[test]
fn save_operations_reject_invalid_input_and_preserve_state() {
    let (state, _directory) = make_state();
    let before = snapshot_value(&state);

    assert_eq!(
        state
            .save_draft(DraftInput {
                id: " ".to_string(),
                title: "invalid".to_string(),
                is_pinned: false,
                subject: String::new(),
                recipient: String::new(),
                opening: String::new(),
                body: String::new(),
                closing: String::new(),
                template_id: None,
                signature_id: None,
                variable_values: BTreeMap::new(),
                tags: Vec::new(),
            })
            .unwrap_err(),
        "下書きIDは空にできません。"
    );

    assert_eq!(
        state
            .save_template(TemplateInput {
                id: "template-invalid".to_string(),
                name: "invalid".to_string(),
                is_pinned: false,
                subject: String::new(),
                recipient: String::new(),
                opening: String::new(),
                body: String::new(),
                closing: String::new(),
                signature_id: Some("missing-signature".to_string()),
                tags: Vec::new(),
            })
            .unwrap_err(),
        "選択した署名が見つかりませんでした。"
    );

    assert_eq!(
        state
            .save_proofreading_settings(ProofreadingSettingsInput {
                disabled_rule_ids: vec!["rule".to_string(); 101],
            })
            .unwrap_err(),
        "無効化する校正ルール数が上限を超えています。"
    );

    assert_eq!(snapshot_value(&state), before);
}

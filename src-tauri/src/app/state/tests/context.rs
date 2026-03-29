use super::*;

#[test]
fn snapshot_counts_context_reports_current_collection_sizes() {
    let snapshot = StoreSnapshot::seeded();
    let context = snapshot_counts_context(&snapshot);

    assert_eq!(context.get("draft_count"), Some(&json!(1)));
    assert_eq!(context.get("variable_preset_count"), Some(&json!(0)));
    assert_eq!(context.get("template_count"), Some(&json!(1)));
    assert_eq!(context.get("signature_count"), Some(&json!(1)));
    assert_eq!(context.get("memo_count"), Some(&json!(0)));
    assert_eq!(context.get("trash_count"), Some(&json!(0)));
}

#[test]
fn proofreading_settings_context_reports_disabled_rule_count() {
    let context = proofreading_settings_context(&ProofreadingSettings {
        disabled_rule_ids: vec!["prh".to_string(), "whitespace.trailing".to_string()],
    });

    assert_eq!(context.get("disabled_rule_count"), Some(&json!(2)));
}

#[test]
fn input_context_builders_capture_safe_lengths_and_flags() {
    let draft = DraftInput {
        id: "draft-1".to_string(),
        title: "Hello".to_string(),
        is_pinned: true,
        subject: "Sub".to_string(),
        recipient: "To".to_string(),
        opening: "Open".to_string(),
        body: "Body".to_string(),
        closing: "Bye".to_string(),
        template_id: Some("template-1".to_string()),
        signature_id: None,
        variable_values: BTreeMap::from([
            ("company".to_string(), "ACME".to_string()),
            ("person".to_string(), "Yamada".to_string()),
        ]),
        tags: vec!["社外".to_string(), "営業".to_string()],
    };
    let template = TemplateInput {
        id: "template-1".to_string(),
        name: "Thanks".to_string(),
        is_pinned: false,
        subject: "Follow up".to_string(),
        recipient: "Customer".to_string(),
        opening: "Hello".to_string(),
        body: "Body".to_string(),
        closing: "Regards".to_string(),
        signature_id: Some("signature-1".to_string()),
        tags: vec!["お礼".to_string()],
    };
    let preset = VariablePresetInput {
        id: "preset-1".to_string(),
        name: "A".to_string(),
        values: BTreeMap::from([("company".to_string(), "ACME".to_string())]),
        tags: vec!["社外".to_string()],
    };
    let signature = SignatureInput {
        id: "signature-1".to_string(),
        name: "Std".to_string(),
        is_pinned: true,
        body: "Team".to_string(),
        is_default: false,
    };
    let memo = MemoInput {
        id: "memo-1".to_string(),
        title: "商談".to_string(),
        is_pinned: false,
        body: "要点".to_string(),
        tags: vec!["会議".to_string()],
    };
    let logging = LoggingSettings {
        mode: LoggingMode::Off,
        retention_days: 30,
    };

    let draft_values = draft_context(&draft);
    assert_eq!(draft_values.get("has_template"), Some(&json!(true)));
    assert_eq!(draft_values.get("has_signature"), Some(&json!(false)));
    assert_eq!(draft_values.get("title_length"), Some(&json!(5)));
    assert_eq!(draft_values.get("is_pinned"), Some(&json!(true)));
    assert_eq!(draft_values.get("variable_count"), Some(&json!(2)));
    assert_eq!(draft_values.get("tag_count"), Some(&json!(2)));

    let template_values = template_context(&template);
    assert_eq!(template_values.get("has_signature"), Some(&json!(true)));
    assert_eq!(template_values.get("name_length"), Some(&json!(6)));
    assert_eq!(template_values.get("subject_length"), Some(&json!(9)));
    assert_eq!(template_values.get("tag_count"), Some(&json!(1)));

    let preset_values = variable_preset_context(&preset);
    assert_eq!(preset_values.get("name_length"), Some(&json!(1)));
    assert_eq!(preset_values.get("value_count"), Some(&json!(1)));
    assert_eq!(preset_values.get("tag_count"), Some(&json!(1)));

    let signature_values = super::super::context::signature_context(&signature);
    assert_eq!(signature_values.get("name_length"), Some(&json!(3)));
    assert_eq!(signature_values.get("body_length"), Some(&json!(4)));
    assert_eq!(signature_values.get("is_pinned"), Some(&json!(true)));
    assert_eq!(signature_values.get("is_default"), Some(&json!(false)));

    let memo_values = memo_context(&memo);
    assert_eq!(memo_values.get("has_title"), Some(&json!(true)));
    assert_eq!(memo_values.get("title_length"), Some(&json!(2)));
    assert_eq!(memo_values.get("body_length"), Some(&json!(2)));
    assert_eq!(memo_values.get("tag_count"), Some(&json!(1)));

    let logging_values = logging_settings_context(&logging);
    assert_eq!(logging_values.get("mode"), Some(&json!("off")));
    assert_eq!(logging_values.get("retention_days"), Some(&json!(30)));
}

#[test]
fn trash_kind_and_merge_context_preserve_expected_keys() {
    let merged = merge_context(
        serde_json::Map::from_iter([
            ("left_only".to_string(), json!(1)),
            ("shared".to_string(), json!("left")),
        ]),
        serde_json::Map::from_iter([
            ("shared".to_string(), json!("right")),
            ("kind".to_string(), json!("template")),
        ]),
    );

    assert_eq!(
        trash_kind_context("template").get("kind"),
        Some(&json!("template"))
    );
    assert_eq!(merged.get("left_only"), Some(&json!(1)));
    assert_eq!(merged.get("shared"), Some(&json!("right")));
    assert_eq!(merged.get("kind"), Some(&json!("template")));
}

mod common;
mod drafts;
mod memo;
mod settings;
mod signatures;
mod templates;
#[cfg(test)]
mod tests;
mod trash;
mod variable_presets;

pub(crate) use common::{load_snapshot, load_startup_notice};
pub(crate) use drafts::{
    delete_draft, permanently_delete_draft_from_trash, restore_draft_from_trash,
    restore_draft_history, save_draft,
};
pub(crate) use memo::{
    delete_memo, permanently_delete_memo_from_trash, restore_memo_from_trash, save_memo,
};
pub(crate) use settings::{
    clear_logs, export_backup, import_backup, load_editor_settings, load_logging_settings,
    load_proofreading_settings, load_recent_logs, save_editor_settings, save_logging_settings,
    save_proofreading_settings,
};
pub(crate) use signatures::{
    delete_signature, permanently_delete_signature_from_trash, restore_signature_from_trash,
    save_signature,
};
pub(crate) use templates::{
    delete_template, permanently_delete_template_from_trash, restore_template_from_trash,
    save_template,
};
pub(crate) use trash::empty_trash;
pub(crate) use variable_presets::{delete_variable_preset, save_variable_preset};

use crate::modules::{
    templates::TemplateInput,
    trash::TrashedTemplate,
    variable_presets::{VariablePreset, VariablePresetInput},
};

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn upsert_template(&mut self, input: TemplateInput, timestamp: &str) {
        if let Some(existing) = self
            .templates
            .iter_mut()
            .find(|template| template.id == input.id)
        {
            existing.update(input, timestamp);
            return;
        }

        self.templates
            .push(crate::modules::templates::Template::new(input, timestamp));
    }

    pub fn delete_template(&mut self, id: &str, timestamp: &str) {
        let Some(index) = self.templates.iter().position(|template| template.id == id) else {
            return;
        };

        let template = self.templates.remove(index);
        self.trash.templates.retain(|entry| entry.template.id != id);
        self.trash.templates.push(TrashedTemplate {
            template,
            deleted_at: timestamp.to_string(),
        });
    }

    pub fn upsert_variable_preset(&mut self, input: VariablePresetInput, timestamp: &str) {
        if let Some(existing) = self
            .variable_presets
            .iter_mut()
            .find(|preset| preset.id == input.id)
        {
            existing.update(input, timestamp);
            return;
        }

        self.variable_presets
            .push(VariablePreset::new(input, timestamp));
    }

    pub fn delete_variable_preset(&mut self, id: &str) -> bool {
        let initial_len = self.variable_presets.len();
        self.variable_presets.retain(|preset| preset.id != id);
        initial_len != self.variable_presets.len()
    }
}

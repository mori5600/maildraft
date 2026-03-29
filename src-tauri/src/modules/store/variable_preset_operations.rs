use crate::modules::variable_presets::{VariablePreset, VariablePresetInput};

use super::StoreSnapshot;

impl StoreSnapshot {
    /// Saves one variable preset into the active store collection.
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

    /// Removes one variable preset from the active store collection.
    pub fn delete_variable_preset(&mut self, id: &str) -> bool {
        let initial_len = self.variable_presets.len();
        self.variable_presets.retain(|preset| preset.id != id);
        initial_len != self.variable_presets.len()
    }

    /// Records the latest usage timestamp for one saved variable preset.
    pub fn mark_variable_preset_used(&mut self, id: &str, timestamp: &str) -> bool {
        let Some(preset) = self
            .variable_presets
            .iter_mut()
            .find(|preset| preset.id == id)
        else {
            return false;
        };

        preset.mark_used(timestamp);
        true
    }
}

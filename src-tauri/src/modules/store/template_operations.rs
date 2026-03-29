use crate::modules::{templates::TemplateInput, trash::TrashedTemplate};

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

    pub fn delete_template(&mut self, id: &str, timestamp: &str) -> Option<TrashedTemplate> {
        let Some(index) = self.templates.iter().position(|template| template.id == id) else {
            return None;
        };

        let template = self.templates.remove(index);
        self.trash.templates.retain(|entry| entry.template.id != id);
        let trashed_template = TrashedTemplate {
            template,
            deleted_at: timestamp.to_string(),
        };
        self.trash.templates.push(trashed_template.clone());
        Some(trashed_template)
    }
}

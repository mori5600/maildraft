use std::{fs, path::PathBuf, sync::Mutex};

use tauri::{AppHandle, Manager};

use crate::modules::{
    drafts::DraftInput, signatures::SignatureInput, store::StoreSnapshot, templates::TemplateInput,
};

type AppResult<T> = Result<T, String>;

pub struct AppState {
    store_path: PathBuf,
    store: Mutex<StoreSnapshot>,
}

impl AppState {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        let store_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&store_dir).map_err(|error| error.to_string())?;

        let store_path = store_dir.join("maildraft-store.json");
        let mut store = if store_path.exists() {
            let content = fs::read_to_string(&store_path).map_err(|error| error.to_string())?;
            serde_json::from_str::<StoreSnapshot>(&content).map_err(|error| error.to_string())?
        } else {
            StoreSnapshot::seeded()
        };

        store.ensure_consistency();
        let state = Self {
            store_path,
            store: Mutex::new(store),
        };
        state.persist_current_store()?;

        Ok(state)
    }

    pub fn load_snapshot(&self) -> AppResult<StoreSnapshot> {
        let store = self.store.lock().map_err(|error| error.to_string())?;
        Ok(store.clone())
    }

    pub fn save_draft(&self, input: DraftInput) -> AppResult<StoreSnapshot> {
        self.mutate_store(|store| {
            store.upsert_draft(input, &timestamp());
        })
    }

    pub fn delete_draft(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.mutate_store(|store| {
            store.delete_draft(id);
        })
    }

    pub fn save_template(&self, input: TemplateInput) -> AppResult<StoreSnapshot> {
        self.mutate_store(|store| {
            store.upsert_template(input, &timestamp());
        })
    }

    pub fn delete_template(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.mutate_store(|store| {
            store.delete_template(id);
        })
    }

    pub fn save_signature(&self, input: SignatureInput) -> AppResult<StoreSnapshot> {
        self.mutate_store(|store| {
            store.upsert_signature(input, &timestamp());
        })
    }

    pub fn delete_signature(&self, id: &str) -> AppResult<StoreSnapshot> {
        self.mutate_store(|store| {
            store.delete_signature(id);
        })
    }

    fn mutate_store<F>(&self, mutator: F) -> AppResult<StoreSnapshot>
    where
        F: FnOnce(&mut StoreSnapshot),
    {
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        mutator(&mut store);
        store.ensure_consistency();
        self.persist_locked_store(&store)?;
        Ok(store.clone())
    }

    fn persist_current_store(&self) -> AppResult<()> {
        let store = self.store.lock().map_err(|error| error.to_string())?;
        self.persist_locked_store(&store)
    }

    fn persist_locked_store(&self, store: &StoreSnapshot) -> AppResult<()> {
        let content = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
        fs::write(&self.store_path, content).map_err(|error| error.to_string())
    }
}

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    format!("{}", duration.as_secs())
}

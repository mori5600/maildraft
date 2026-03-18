use crate::modules::{
    signatures::{Signature, SignatureInput},
    trash::TrashedSignature,
};

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn upsert_signature(&mut self, input: SignatureInput, timestamp: &str) {
        if input.is_default {
            for signature in &mut self.signatures {
                signature.is_default = false;
            }
        }

        if let Some(existing) = self
            .signatures
            .iter_mut()
            .find(|signature| signature.id == input.id)
        {
            existing.update(input, timestamp);
            return;
        }

        self.signatures.push(Signature::new(input, timestamp));
    }

    pub fn delete_signature(&mut self, id: &str, timestamp: &str) -> Option<TrashedSignature> {
        let Some(index) = self
            .signatures
            .iter()
            .position(|signature| signature.id == id)
        else {
            return None;
        };

        let signature = self.signatures.remove(index);
        self.trash
            .signatures
            .retain(|entry| entry.signature.id != id);
        let trashed_signature = TrashedSignature {
            signature,
            deleted_at: timestamp.to_string(),
        };
        self.trash.signatures.push(trashed_signature.clone());
        Some(trashed_signature)
    }
}

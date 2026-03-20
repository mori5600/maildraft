use std::collections::BTreeMap;

use crate::modules::{
    drafts::Draft, signatures::Signature, templates::Template, trash::TrashSnapshot,
};

use super::StoreSnapshot;

impl StoreSnapshot {
    pub fn seeded() -> Self {
        let timestamp = "0";
        let signature = Signature {
            id: "signature-default".to_string(),
            name: "標準署名".to_string(),
            is_pinned: false,
            body: "株式会社△△\n山田 太郎\nProduct Team".to_string(),
            is_default: true,
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        let template = Template {
            id: "template-thanks".to_string(),
            name: "お礼メール".to_string(),
            is_pinned: false,
            subject: "お打ち合わせのお礼".to_string(),
            recipient: "株式会社〇〇\n営業部\n佐藤 様".to_string(),
            opening: "いつもお世話になっております。\n株式会社△△の山田です。".to_string(),
            body: "先日は {{案件名}} のお打ち合わせのお時間をいただき、ありがとうございました。\nお話しした内容を踏まえて、次のご提案を整理してご連絡します。".to_string(),
            closing: "引き続きよろしくお願いいたします。".to_string(),
            signature_id: Some(signature.id.clone()),
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        let draft = Draft {
            id: "draft-welcome".to_string(),
            title: "最初の下書き".to_string(),
            is_pinned: false,
            subject: template.subject.clone(),
            recipient: template.recipient.clone(),
            opening: "いつもお世話になっております。\n株式会社△△の山田です。".to_string(),
            body: "本日はメール下書きエディタのご相談でお時間をいただき、ありがとうございました。\nご相談いただいた内容を社内で整理のうえ、改めてご連絡いたします。".to_string(),
            closing: "引き続きよろしくお願いいたします。".to_string(),
            template_id: Some(template.id.clone()),
            signature_id: Some(signature.id.clone()),
            variable_values: BTreeMap::from([(
                "案件名".to_string(),
                "メール下書きエディタ".to_string(),
            )]),
            created_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };

        Self {
            drafts: vec![draft],
            draft_history: Vec::new(),
            variable_presets: Vec::new(),
            templates: vec![template],
            signatures: vec![signature],
            memos: Vec::new(),
            legacy_memo: None,
            trash: TrashSnapshot::default(),
        }
    }
}

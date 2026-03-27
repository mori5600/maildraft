use std::{collections::HashSet, mem};

pub fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for tag in tags {
        let tag = tag.trim().to_string();
        if tag.is_empty() {
            continue;
        }

        if seen.insert(tag.clone()) {
            normalized.push(tag);
        }
    }

    normalized
}

pub fn normalize_tags_in_place(tags: &mut Vec<String>) {
    *tags = normalize_tags(mem::take(tags));
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::{normalize_tags, normalize_tags_in_place};

    #[test]
    fn normalize_tags_trims_deduplicates_and_preserves_first_seen_order() {
        assert_eq!(
            normalize_tags(vec![
                " 社外 ".to_string(),
                "".to_string(),
                "営業".to_string(),
                "社外".to_string(),
                "  ".to_string(),
                "営業".to_string(),
                "採用".to_string(),
            ]),
            vec!["社外".to_string(), "営業".to_string(), "採用".to_string(),]
        );
    }

    #[test]
    fn normalize_tags_in_place_rewrites_the_existing_buffer() {
        let mut tags = vec![" a ".to_string(), "a".to_string(), "b".to_string()];
        normalize_tags_in_place(&mut tags);
        assert_eq!(tags, vec!["a".to_string(), "b".to_string()]);
    }
}

type TagList = readonly string[] | null | undefined;
type TaggedItem = { tags?: TagList };

export const MAX_TAGS_PER_ITEM = 20;
export const MAX_TAG_LENGTH = 40;

function toTagArray(tags: TagList): string[] {
  return tags ? [...tags] : [];
}

export function normalizeTag(rawTag: string): string {
  return rawTag.trim();
}

export function canAddTag(tags: TagList, rawTag: string): boolean {
  const nextTag = normalizeTag(rawTag);
  const currentTags = toTagArray(tags);

  return (
    nextTag.length > 0 &&
    nextTag.length <= MAX_TAG_LENGTH &&
    currentTags.length < MAX_TAGS_PER_ITEM &&
    !currentTags.includes(nextTag)
  );
}

export function addTag(tags: TagList, rawTag: string): string[] {
  if (!canAddTag(tags, rawTag)) {
    return toTagArray(tags);
  }

  return [...toTagArray(tags), normalizeTag(rawTag)];
}

export function removeTag(tags: TagList, targetTag: string): string[] {
  return toTagArray(tags).filter((tag) => tag !== targetTag);
}

export function matchesTagFilter(tags: TagList, activeTag: string | null): boolean {
  if (!activeTag) {
    return true;
  }

  return toTagArray(tags).includes(activeTag);
}

export function collectUniqueTags(items: TaggedItem[]): string[] {
  const seen = new Set<string>();
  const uniqueTags: string[] = [];

  for (const item of items) {
    for (const tag of toTagArray(item.tags)) {
      if (seen.has(tag)) {
        continue;
      }

      seen.add(tag);
      uniqueTags.push(tag);
    }
  }

  return uniqueTags;
}

export function mergeUniqueTags(primary: TagList, secondary: TagList): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const tag of [...toTagArray(primary), ...toTagArray(secondary)]) {
    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    merged.push(tag);
  }

  return merged;
}

export function tagsEqual(left: TagList, right: TagList): boolean {
  const leftTags = toTagArray(left);
  const rightTags = toTagArray(right);

  if (leftTags.length !== rightTags.length) {
    return false;
  }

  return leftTags.every((tag, index) => tag === rightTags[index]);
}

export interface TagSuggestionOption {
  kind: "existing" | "create";
  label: string;
  value: string;
}

export function buildTagSuggestionOptions(
  availableTags: string[],
  tags: string[],
  normalizedPendingTag: string,
  canCreateTag: boolean,
): TagSuggestionOption[] {
  const lowerCaseQuery = normalizedPendingTag.toLocaleLowerCase();
  const selectedTags = new Set(tags);
  const prefixMatches: TagSuggestionOption[] = [];
  const partialMatches: TagSuggestionOption[] = [];

  for (const tag of availableTags) {
    if (selectedTags.has(tag)) {
      continue;
    }

    const lowerCaseTag = tag.toLocaleLowerCase();
    if (lowerCaseQuery && !lowerCaseTag.includes(lowerCaseQuery)) {
      continue;
    }

    const option: TagSuggestionOption = {
      kind: "existing",
      label: tag,
      value: tag,
    };

    if (lowerCaseQuery && lowerCaseTag.startsWith(lowerCaseQuery)) {
      prefixMatches.push(option);
      continue;
    }

    partialMatches.push(option);
  }

  const options = [...prefixMatches, ...partialMatches].slice(0, 8);
  const shouldShowCreateOption =
    canCreateTag && !options.some((option) => option.value === normalizedPendingTag);

  if (shouldShowCreateOption) {
    options.push({
      kind: "create",
      label: `「${normalizedPendingTag}」を追加`,
      value: normalizedPendingTag,
    });
  }

  return options;
}

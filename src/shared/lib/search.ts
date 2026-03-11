function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
}

export function matchesSearchQuery(
  query: string,
  values: Array<string | null | undefined>,
): boolean {
  const normalizedQuery = normalizeSearchText(query).trim();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = values.map((value) => normalizeSearchText(value ?? "")).join("\n");

  return normalizedQuery.split(/\s+/).every((token) => haystack.includes(token));
}

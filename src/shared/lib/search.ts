function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
}

export function createSearchTokens(query: string): string[] {
  const normalizedQuery = normalizeSearchText(query).trim();

  return normalizedQuery ? normalizedQuery.split(/\s+/) : [];
}

export function buildSearchHaystack(values: Array<string | null | undefined>): string {
  return values.map((value) => normalizeSearchText(value ?? "")).join("\n");
}

export function matchesSearchTokens(tokens: string[], haystack: string): boolean {
  return tokens.every((token) => haystack.includes(token));
}

export function matchesSearchQuery(
  query: string,
  values: Array<string | null | undefined>,
): boolean {
  const tokens = createSearchTokens(query);

  if (tokens.length === 0) {
    return true;
  }

  return matchesSearchTokens(tokens, buildSearchHaystack(values));
}

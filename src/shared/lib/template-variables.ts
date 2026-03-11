const TOKEN_REGEX = /{{\s*([^}]+?)\s*}}/g;

export function extractVariableNames(texts: string[]): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];

  for (const text of texts) {
    for (const match of text.matchAll(TOKEN_REGEX)) {
      const name = (match[1] ?? "").trim();
      if (!name || found.has(name)) {
        continue;
      }

      found.add(name);
      ordered.push(name);
    }
  }

  return ordered;
}

export function resolveVariableTokens(
  text: string,
  variableValues: Record<string, string>,
): string {
  return text.replace(TOKEN_REGEX, (token: string, name: string) => {
    const resolved = variableValues[String(name).trim()];

    if (typeof resolved !== "string" || resolved.trim().length === 0) {
      return token;
    }

    return resolved;
  });
}

export function collectMissingVariableNames(
  variableNames: string[],
  variableValues: Record<string, string>,
): string[] {
  return variableNames.filter((name) => (variableValues[name] ?? "").trim().length === 0);
}

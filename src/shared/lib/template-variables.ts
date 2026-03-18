const TOKEN_REGEX = /{{\s*([^}]+?)\s*}}/g;

export interface ResolvedVariableTokensResult {
  resolvedText: string;
  variableNames: string[];
}

export function extractVariableNames(texts: string[]): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];

  for (const text of texts) {
    collectTextVariableNames(text, found, ordered);
  }

  return ordered;
}

/**
 * Missing values stay in token form.
 *
 * Callers rely on that to surface unresolved placeholders.
 */
export function resolveVariableTokens(
  text: string,
  variableValues: Record<string, string>,
): string {
  const tokenRegex = createTokenRegex();
  const resolvedParts: string[] = [];
  let cursor = 0;
  let match = tokenRegex.exec(text);

  while (match) {
    const token = match[0] ?? "";
    const name = normalizeVariableName(match[1]);
    const resolved = variableValues[name];

    resolvedParts.push(text.slice(cursor, match.index));
    resolvedParts.push(typeof resolved === "string" && resolved.trim().length > 0 ? resolved : token);

    cursor = match.index + token.length;
    match = tokenRegex.exec(text);
  }

  if (cursor === 0) {
    return text;
  }

  resolvedParts.push(text.slice(cursor));
  return resolvedParts.join("");
}

/** Use this when the caller needs resolved text and variable order in one pass. */
export function resolveVariableTokensWithNames(
  text: string,
  variableValues: Record<string, string>,
): ResolvedVariableTokensResult {
  const found = new Set<string>();
  const variableNames: string[] = [];
  const resolvedParts: string[] = [];
  const tokenRegex = createTokenRegex();
  let cursor = 0;
  let match = tokenRegex.exec(text);

  while (match) {
    const token = match[0] ?? "";
    const name = normalizeVariableName(match[1]);
    const resolved = variableValues[name];

    resolvedParts.push(text.slice(cursor, match.index));
    if (name) {
      appendVariableName(name, found, variableNames);
    }
    resolvedParts.push(typeof resolved === "string" && resolved.trim().length > 0 ? resolved : token);

    cursor = match.index + token.length;
    match = tokenRegex.exec(text);
  }

  if (cursor === 0) {
    return {
      resolvedText: text,
      variableNames,
    };
  }

  resolvedParts.push(text.slice(cursor));

  return {
    resolvedText: resolvedParts.join(""),
    variableNames,
  };
}

export function collectMissingVariableNames(
  variableNames: string[],
  variableValues: Record<string, string>,
): string[] {
  return variableNames.filter((name) => (variableValues[name] ?? "").trim().length === 0);
}

function collectTextVariableNames(
  text: string,
  found: Set<string>,
  ordered: string[],
) {
  const tokenRegex = createTokenRegex();
  let match = tokenRegex.exec(text);

  while (match) {
    const name = normalizeVariableName(match[1]);

    if (name) {
      appendVariableName(name, found, ordered);
    }

    match = tokenRegex.exec(text);
  }
}

function appendVariableName(name: string, found: Set<string>, ordered: string[]) {
  if (found.has(name)) {
    return;
  }

  found.add(name);
  ordered.push(name);
}

function normalizeVariableName(value: string | undefined): string {
  return (value ?? "").trim();
}

function createTokenRegex(): RegExp {
  return new RegExp(TOKEN_REGEX);
}

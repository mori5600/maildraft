import {
  createDraftProofreadingIssueId,
  type DraftProofreadingEdit,
  type DraftProofreadingEditableField,
  type DraftProofreadingField,
  type DraftProofreadingIssue,
  type DraftProofreadingLocation,
  type DraftProofreadingSuggestion,
} from "./model";

export function createDraftProofreadingIssue(input: {
  description: string;
  excerpt: string;
  field: DraftProofreadingField;
  location?: DraftProofreadingLocation;
  ruleId: string;
  severity: DraftProofreadingIssue["severity"];
  suggestion?: DraftProofreadingSuggestion;
  title: string;
}): DraftProofreadingIssue {
  return {
    ...input,
    id: createDraftProofreadingIssueId(input.ruleId, input.field, input.location, input.excerpt),
  };
}

export function createReplacementSuggestion(
  field: DraftProofreadingEditableField,
  sourceText: string,
  from: number,
  to: number,
  replacement: string,
  label: string,
): DraftProofreadingSuggestion {
  const edit: DraftProofreadingEdit = {
    field,
    from,
    originalText: sourceText.slice(from, to),
    replacement,
    to,
  };

  return {
    edits: [edit],
    label,
  };
}

export function deduplicateDraftProofreadingIssues(
  issues: DraftProofreadingIssue[],
): DraftProofreadingIssue[] {
  const seen = new Set<string>();
  const ordered: DraftProofreadingIssue[] = [];

  for (const issue of issues) {
    if (seen.has(issue.id)) {
      continue;
    }

    seen.add(issue.id);
    ordered.push(issue);
  }

  return ordered;
}

export function lineExcerpt(text: string, from: number, to: number): string {
  const lineStart = text.lastIndexOf("\n", from - 1) + 1;
  const nextBreak = text.indexOf("\n", to);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return text.slice(lineStart, lineEnd);
}

export function excerptWithContext(text: string, from: number, to: number): string {
  const contextStart = Math.max(0, from - 10);
  const contextEnd = Math.min(text.length, to + 10);
  return text.slice(contextStart, contextEnd);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

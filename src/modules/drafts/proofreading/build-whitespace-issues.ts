import type { DraftInput } from "../model";
import type { DraftProofreadingEditableField, DraftProofreadingIssue } from "./model";
import {
  createDraftProofreadingIssue,
  createReplacementSuggestion,
  excerptWithContext,
  lineExcerpt,
} from "./proofreading-issue-factory";
import { getDraftProofreadingRuleDefinition, textCheckFields } from "./proofreading-rule-data";

interface WhitespaceMatch {
  matchedText: string;
  from: number;
  to: number;
}

interface WhitespaceIssueStrategy {
  createIssue: (input: {
    field: DraftProofreadingEditableField;
    match: WhitespaceMatch;
    text: string;
  }) => DraftProofreadingIssue;
  pattern: RegExp;
  shouldSkipMatch?: (input: {
    field: DraftProofreadingEditableField;
    match: WhitespaceMatch;
    text: string;
  }) => boolean;
}

const whitespaceIssueStrategies: WhitespaceIssueStrategy[] = [
  {
    createIssue: ({ field, match, text }) => {
      const definition = getRuleDefinition("whitespace.trailing");

      return createDraftProofreadingIssue({
        description: definition.description,
        excerpt: lineExcerpt(text, match.from, match.to),
        field,
        location: { from: match.from, to: match.to },
        ruleId: "whitespace.trailing",
        severity: definition.severity,
        suggestion: createReplacementSuggestion(
          field,
          text,
          match.from,
          match.to,
          "",
          "候補を適用",
        ),
        title: definition.title,
      });
    },
    pattern: /[ \t\u3000]+$/gm,
  },
  {
    createIssue: ({ field, match, text }) => {
      const definition = getRuleDefinition("whitespace.multiple");

      return createDraftProofreadingIssue({
        description: definition.description,
        excerpt: excerptWithContext(text, match.from, match.to),
        field,
        location: { from: match.from, to: match.to },
        ruleId: "whitespace.multiple",
        severity: definition.severity,
        suggestion: createReplacementSuggestion(
          field,
          text,
          match.from,
          match.to,
          normalizeWhitespaceReplacement(match.matchedText),
          "候補を適用",
        ),
        title: definition.title,
      });
    },
    pattern: / {2,}|\u3000{2,}/g,
    shouldSkipMatch: ({ match, text }) =>
      match.from === 0 ||
      text[match.from - 1] === "\n" ||
      match.to === text.length ||
      text[match.to] === "\n",
  },
];

export function buildWhitespaceIssues(draft: DraftInput): DraftProofreadingIssue[] {
  return textCheckFields.flatMap((field) => buildWhitespaceIssuesForField(field, draft[field]));
}

function buildWhitespaceIssuesForField(
  field: DraftProofreadingEditableField,
  text: string,
): DraftProofreadingIssue[] {
  return whitespaceIssueStrategies.flatMap((strategy) =>
    collectRegexMatches(text, strategy.pattern)
      .filter((match) => !strategy.shouldSkipMatch?.({ field, match, text }))
      .map((match) => strategy.createIssue({ field, match, text })),
  );
}

function collectRegexMatches(text: string, pattern: RegExp): WhitespaceMatch[] {
  return [...text.matchAll(pattern)].map((match) => ({
    from: match.index ?? 0,
    matchedText: match[0],
    to: (match.index ?? 0) + match[0].length,
  }));
}

function normalizeWhitespaceReplacement(matchedText: string): string {
  return matchedText[0] === "　" ? "　" : " ";
}

function getRuleDefinition(ruleId: string) {
  const definition = getDraftProofreadingRuleDefinition(ruleId);

  if (!definition) {
    throw new Error(`Unknown proofreading rule: ${ruleId}`);
  }

  return definition;
}

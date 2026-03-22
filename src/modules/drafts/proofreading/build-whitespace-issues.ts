import type { DraftInput } from "../model";
import type { DraftProofreadingEditableField, DraftProofreadingIssue } from "./model";
import {
  createDraftProofreadingIssue,
  createReplacementSuggestion,
  excerptWithContext,
  lineExcerpt,
} from "./proofreading-issue-factory";
import { textCheckFields } from "./proofreading-rule-data";

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
    createIssue: ({ field, match, text }) =>
      createDraftProofreadingIssue({
        description: "末尾の空白は見た目では分かりづらく、コピー後にも残りやすいです。",
        excerpt: lineExcerpt(text, match.from, match.to),
        field,
        location: { from: match.from, to: match.to },
        ruleId: "whitespace.trailing",
        severity: "warning",
        suggestion: createReplacementSuggestion(
          field,
          text,
          match.from,
          match.to,
          "",
          "候補を適用",
        ),
        title: "行末に不要な空白があります。",
      }),
    pattern: /[ \t\u3000]+$/gm,
  },
  {
    createIssue: ({ field, match, text }) =>
      createDraftProofreadingIssue({
        description: "連続スペースは意図が伝わりにくいため、通常は 1 文字にそろえる方が安全です。",
        excerpt: excerptWithContext(text, match.from, match.to),
        field,
        location: { from: match.from, to: match.to },
        ruleId: "whitespace.multiple",
        severity: "warning",
        suggestion: createReplacementSuggestion(
          field,
          text,
          match.from,
          match.to,
          normalizeWhitespaceReplacement(match.matchedText),
          "候補を適用",
        ),
        title: "連続したスペースがあります。",
      }),
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

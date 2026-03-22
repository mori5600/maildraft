import type { DraftInput } from "../model";
import type { DraftProofreadingEditableField, DraftProofreadingIssue } from "./model";
import {
  createDraftProofreadingIssue,
  createReplacementSuggestion,
  escapeRegExp,
} from "./proofreading-issue-factory";
import {
  type DraftProofreadingPhraseRule,
  type DraftProofreadingPhraseRuleStrategy,
  phraseRuleStrategies,
  repeatedLineFields,
  textCheckFields,
} from "./proofreading-rule-data";

interface ExpressionIssueStrategy {
  buildIssues: (draft: DraftInput) => DraftProofreadingIssue[];
}

const expressionIssueStrategies: ExpressionIssueStrategy[] = [
  {
    buildIssues: buildRepeatedLineIssues,
  },
  ...phraseRuleStrategies.map((strategy) => ({
    buildIssues: (draft: DraftInput) => buildPhraseIssues(draft, strategy),
  })),
];

export function buildExpressionIssues(draft: DraftInput): DraftProofreadingIssue[] {
  return expressionIssueStrategies.flatMap((strategy) => strategy.buildIssues(draft));
}

function buildRepeatedLineIssues(draft: DraftInput): DraftProofreadingIssue[] {
  return repeatedLineFields.flatMap((field) =>
    buildRepeatedLineIssuesForField(field, draft[field]),
  );
}

function buildRepeatedLineIssuesForField(
  field: DraftProofreadingEditableField,
  text: string,
): DraftProofreadingIssue[] {
  const issues: DraftProofreadingIssue[] = [];
  let offset = 0;
  let previousNormalized = "";
  let previousWasEmpty = true;

  for (const line of text.split("\n")) {
    const normalized = line.trim();
    const lineStart = offset;
    const lineEnd = offset + line.length;

    if (normalized.length >= 4 && !previousWasEmpty && normalized === previousNormalized) {
      const removalEnd = text[lineEnd] === "\n" ? lineEnd + 1 : lineEnd;

      issues.push(
        createDraftProofreadingIssue({
          description: "同じ行が連続しているため、誤って重複した可能性があります。",
          excerpt: line,
          field,
          location: { from: lineStart, to: lineEnd },
          ruleId: "expression.repeated-line",
          severity: "warning",
          suggestion: createReplacementSuggestion(
            field,
            text,
            lineStart,
            removalEnd,
            "",
            "重複行を削除",
          ),
          title: "重複表現の可能性があります。",
        }),
      );
    }

    previousNormalized = normalized;
    previousWasEmpty = normalized.length === 0;
    offset = lineEnd + 1;
  }

  return issues;
}

function buildPhraseIssues(
  draft: DraftInput,
  strategy: DraftProofreadingPhraseRuleStrategy,
): DraftProofreadingIssue[] {
  return textCheckFields.flatMap((field) =>
    buildPhraseIssuesForField(field, draft[field], strategy),
  );
}

function buildPhraseIssuesForField(
  field: DraftProofreadingEditableField,
  text: string,
  strategy: DraftProofreadingPhraseRuleStrategy,
): DraftProofreadingIssue[] {
  return strategy.rules.flatMap((rule) => createPhraseRuleIssues(field, text, rule, strategy));
}

function createPhraseRuleIssues(
  field: DraftProofreadingEditableField,
  text: string,
  rule: DraftProofreadingPhraseRule,
  strategy: DraftProofreadingPhraseRuleStrategy,
): DraftProofreadingIssue[] {
  return [...text.matchAll(new RegExp(escapeRegExp(rule.phrase), "g"))].map((match) => {
    const from = match.index ?? 0;
    const to = from + rule.phrase.length;

    return createDraftProofreadingIssue({
      description: rule.description,
      excerpt: rule.phrase,
      field,
      location: { from, to },
      ruleId: rule.ruleId,
      severity: strategy.severity,
      suggestion: createReplacementSuggestion(
        field,
        text,
        from,
        to,
        rule.replacement,
        strategy.suggestionLabel,
      ),
      title: strategy.title,
    });
  });
}

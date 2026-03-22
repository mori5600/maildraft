import type { TextlintMessage } from "@textlint/kernel";

import {
  detailedProofreadingPhraseRuleIndex,
  detailedProofreadingRuleDefinitions,
  type DetailedRuleDefinition,
} from "./detailed-proofreading-rule-set";
import {
  type DetailedProofreadingStrategy,
  resolveDetailedProofreadingStrategy,
} from "./detailed-proofreading-strategy";
import {
  createDraftProofreadingIssueId,
  type DraftProofreadingEditableField,
  type DraftProofreadingIssue,
  type DraftProofreadingLocation,
  type DraftProofreadingSeverity,
  type DraftProofreadingSuggestion,
} from "./model";
import type { DraftProofreadingPhraseRule } from "./proofreading-rule-data";

interface DetailedSuggestionInput {
  field: DraftProofreadingEditableField;
  message: TextlintMessage;
  sourceText: string;
}

interface DetailedLocationInput {
  message: TextlintMessage;
}

interface DetailedExcerptInput {
  location: DraftProofreadingLocation | undefined;
  sourceText: string;
  suggestion: DraftProofreadingSuggestion | undefined;
}

interface DetailedRuleMetadataInput {
  message: TextlintMessage;
  excerpt: string;
  phraseRule: DraftProofreadingPhraseRule | undefined;
  ruleDefinition: DetailedRuleDefinition | undefined;
  suggestion: DraftProofreadingSuggestion | undefined;
}

const suggestionStrategies: DetailedProofreadingStrategy<
  DetailedSuggestionInput,
  DraftProofreadingSuggestion | undefined
>[] = [
  {
    matches: ({ message }) => Boolean(message.fix),
    resolve: ({ field, message, sourceText }) => {
      const [from, to] = message.fix!.range;
      return {
        edits: [
          {
            field,
            from,
            originalText: sourceText.slice(from, to),
            replacement: message.fix!.text,
            to,
          },
        ],
        label: "候補を適用",
      };
    },
  },
];

const locationStrategies: DetailedProofreadingStrategy<
  DetailedLocationInput,
  DraftProofreadingLocation | undefined
>[] = [
  {
    matches: ({ message }) => Boolean(message.fix),
    resolve: ({ message }) => ({
      from: message.fix!.range[0],
      to: message.fix!.range[1],
    }),
  },
  {
    matches: ({ message }) => Boolean(message.range),
    resolve: ({ message }) => ({
      from: message.range![0],
      to: message.range![1],
    }),
  },
];

const excerptStrategies: DetailedProofreadingStrategy<DetailedExcerptInput, string>[] = [
  {
    matches: ({ suggestion }) => Boolean(suggestion),
    resolve: ({ sourceText, suggestion }) => {
      const [edit] = suggestion!.edits;
      return sourceText.slice(edit.from, edit.to);
    },
  },
  {
    matches: ({ location }) => Boolean(location),
    resolve: ({ location, sourceText }) =>
      excerptWithContext(sourceText, location!.from, location!.to),
  },
];

const prhTitleStrategies: DetailedProofreadingStrategy<DraftProofreadingPhraseRule, string>[] = [
  {
    matches: (phraseRule) => phraseRule.ruleId.startsWith("honorific"),
    resolve: () => "二重敬語の候補があります。",
  },
];

const ruleMetadataStrategies: DetailedProofreadingStrategy<
  DetailedRuleMetadataInput,
  DetailedRuleDefinition & { severity: DraftProofreadingSeverity }
>[] = [
  {
    matches: ({ message, phraseRule }) => message.ruleId === "prh" && Boolean(phraseRule),
    resolve: ({ phraseRule }) => ({
      description: phraseRule!.description,
      severity: "warning",
      title: resolveDetailedProofreadingStrategy(
        prhTitleStrategies,
        phraseRule!,
        () => "非推奨表現の可能性があります。",
      ),
    }),
  },
  {
    matches: ({ ruleDefinition }) => Boolean(ruleDefinition),
    resolve: ({ message, ruleDefinition }) => ({
      description: ruleDefinition!.description ?? message.message,
      severity: ruleDefinition!.severity ?? toDraftProofreadingSeverity(message.severity),
      title: ruleDefinition!.title ?? "文章表現の見直し候補があります。",
    }),
  },
];

const severityStrategies: DetailedProofreadingStrategy<
  number | undefined,
  DraftProofreadingSeverity
>[] = [
  {
    matches: (severity) => !severity || severity <= 1,
    resolve: () => "info",
  },
];

export function mapDetailedLintMessageToIssue(input: {
  field: DraftProofreadingEditableField;
  message: TextlintMessage;
  sourceText: string;
}): DraftProofreadingIssue {
  const suggestion = createDetailedSuggestion({
    field: input.field,
    message: input.message,
    sourceText: input.sourceText,
  });
  const location = createDetailedLocation({
    message: input.message,
  });
  const excerpt = createDetailedExcerpt({
    location,
    sourceText: input.sourceText,
    suggestion,
  });
  const metadata = describeDetailedRule({
    excerpt,
    message: input.message,
    phraseRule: findPhraseRule(excerpt, suggestion?.edits[0]?.replacement ?? ""),
    ruleDefinition: input.message.ruleId
      ? detailedProofreadingRuleDefinitions.get(input.message.ruleId)
      : undefined,
    suggestion,
  });

  return {
    description: metadata.description,
    excerpt,
    field: input.field,
    id: createDraftProofreadingIssueId(
      input.message.ruleId ?? "textlint",
      input.field,
      location,
      `${excerpt}:${suggestion?.edits[0]?.replacement ?? ""}`,
    ),
    location,
    ruleId: input.message.ruleId ?? "textlint",
    severity: metadata.severity,
    suggestion,
    title: metadata.title,
  };
}

function createDetailedSuggestion(
  input: DetailedSuggestionInput,
): DraftProofreadingSuggestion | undefined {
  return resolveDetailedProofreadingStrategy(suggestionStrategies, input, () => undefined);
}

function createDetailedLocation(
  input: DetailedLocationInput,
): DraftProofreadingLocation | undefined {
  return resolveDetailedProofreadingStrategy(locationStrategies, input, () => undefined);
}

function createDetailedExcerpt(input: DetailedExcerptInput): string {
  return resolveDetailedProofreadingStrategy(excerptStrategies, input, ({ sourceText }) =>
    sourceText.trim().slice(0, 48),
  );
}

function describeDetailedRule(
  input: DetailedRuleMetadataInput,
): DetailedRuleDefinition & { severity: DraftProofreadingSeverity } {
  return resolveDetailedProofreadingStrategy(ruleMetadataStrategies, input, ({ message }) => ({
    description: message.message,
    severity: toDraftProofreadingSeverity(message.severity),
    title: "文章表現の見直し候補があります。",
  }));
}

function findPhraseRule(
  excerpt: string,
  replacement: string,
): DraftProofreadingPhraseRule | undefined {
  const directMatch = detailedProofreadingPhraseRuleIndex.get(excerpt);

  if (directMatch?.replacement === replacement) {
    return directMatch;
  }

  return [...detailedProofreadingPhraseRuleIndex.values()].find(
    (rule) => rule.phrase === excerpt && rule.replacement === replacement,
  );
}

function excerptWithContext(text: string, from: number, to: number): string {
  const contextStart = Math.max(0, from - 12);
  const contextEnd = Math.min(text.length, to + 12);
  return text.slice(contextStart, contextEnd);
}

function toDraftProofreadingSeverity(severity: number | undefined): DraftProofreadingSeverity {
  return resolveDetailedProofreadingStrategy(severityStrategies, severity, () => "warning");
}

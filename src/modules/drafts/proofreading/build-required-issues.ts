import type { Signature } from "../../signatures/model";
import type { DraftInput } from "../model";
import { DRAFT_SUBJECT_WARNING_LENGTH, type DraftProofreadingIssue } from "./model";
import {
  createDraftProofreadingIssue,
  createReplacementSuggestion,
} from "./proofreading-issue-factory";
import {
  createMissingVariablesRuleDefinition,
  createSubjectLengthRuleDefinition,
  getDraftProofreadingRuleDefinition,
} from "./proofreading-rule-data";

interface RequiredIssueInput {
  draft: DraftInput;
  missingVariables: string[];
  signature: Signature | undefined;
  subjectLength: number;
  trimmedSubject: string;
}

interface RequiredIssueStrategy {
  createIssue: (input: RequiredIssueInput) => DraftProofreadingIssue;
  matches: (input: RequiredIssueInput) => boolean;
}

const requiredIssueStrategies: RequiredIssueStrategy[] = [
  {
    createIssue: () =>
      createIssueFromRuleDefinition("required.subject", {
        excerpt: "",
        field: "subject",
      }),
    matches: ({ trimmedSubject }) => trimmedSubject.length === 0,
  },
  {
    createIssue: ({ trimmedSubject }) => {
      const definition = createSubjectLengthRuleDefinition(DRAFT_SUBJECT_WARNING_LENGTH);

      return createDraftProofreadingIssue({
        description: definition.description,
        excerpt: trimmedSubject,
        field: "subject",
        ruleId: "subject.length",
        severity: definition.severity,
        title: definition.title,
      });
    },
    matches: ({ subjectLength, trimmedSubject }) =>
      trimmedSubject.length > 0 && subjectLength > DRAFT_SUBJECT_WARNING_LENGTH,
  },
  {
    createIssue: () =>
      createIssueFromRuleDefinition("required.recipient-or-opening", {
        excerpt: "",
        field: "recipient",
      }),
    matches: ({ draft }) => !draft.recipient.trim() && !draft.opening.trim(),
  },
  {
    createIssue: () =>
      createIssueFromRuleDefinition("required.body", {
        excerpt: "",
        field: "body",
      }),
    matches: ({ draft }) => !draft.body.trim(),
  },
  {
    createIssue: ({ draft }) =>
      createIssueFromRuleDefinition("required.closing", {
        excerpt: "",
        field: "closing",
        suggestion: createReplacementSuggestion(
          "closing",
          draft.closing,
          0,
          draft.closing.length,
          "引き続きよろしくお願いいたします。",
          "候補を適用",
        ),
      }),
    matches: ({ draft }) => !draft.closing.trim(),
  },
  {
    createIssue: () =>
      createIssueFromRuleDefinition("required.signature", {
        excerpt: "",
        field: "signature",
      }),
    matches: ({ signature }) => !signature?.body.trim(),
  },
  {
    createIssue: ({ missingVariables }) => {
      const definition = createMissingVariablesRuleDefinition(missingVariables);

      return createDraftProofreadingIssue({
        description: definition.description,
        excerpt: missingVariables.join(", "),
        field: "body",
        ruleId: "variables.missing",
        severity: definition.severity,
        title: definition.title,
      });
    },
    matches: ({ missingVariables }) => missingVariables.length > 0,
  },
];

export function buildRequiredIssues(
  draft: DraftInput,
  signature: Signature | undefined,
  missingVariables: string[],
): DraftProofreadingIssue[] {
  const trimmedSubject = draft.subject.trim();
  const input: RequiredIssueInput = {
    draft,
    missingVariables,
    signature,
    subjectLength: Array.from(trimmedSubject).length,
    trimmedSubject,
  };

  return requiredIssueStrategies
    .filter((strategy) => strategy.matches(input))
    .map((strategy) => strategy.createIssue(input));
}

function createIssueFromRuleDefinition(
  ruleId: string,
  input: {
    excerpt: string;
    field: DraftProofreadingIssue["field"];
    suggestion?: DraftProofreadingIssue["suggestion"];
  },
): DraftProofreadingIssue {
  const definition = getRuleDefinition(ruleId);

  return createDraftProofreadingIssue({
    description: definition.description,
    excerpt: input.excerpt,
    field: input.field,
    ruleId,
    severity: definition.severity,
    suggestion: input.suggestion,
    title: definition.title,
  });
}

function getRuleDefinition(ruleId: string) {
  const definition = getDraftProofreadingRuleDefinition(ruleId);

  if (!definition) {
    throw new Error(`Unknown proofreading rule: ${ruleId}`);
  }

  return definition;
}

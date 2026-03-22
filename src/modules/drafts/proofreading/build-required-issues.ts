import type { Signature } from "../../signatures/model";
import type { DraftInput } from "../model";
import { DRAFT_SUBJECT_WARNING_LENGTH, type DraftProofreadingIssue } from "./model";
import {
  createDraftProofreadingIssue,
  createReplacementSuggestion,
} from "./proofreading-issue-factory";

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
      createDraftProofreadingIssue({
        description: "件名がないと、受信者が要件を判断しにくくなります。",
        excerpt: "",
        field: "subject",
        ruleId: "required.subject",
        severity: "error",
        title: "件名が未入力です。",
      }),
    matches: ({ trimmedSubject }) => trimmedSubject.length === 0,
  },
  {
    createIssue: ({ trimmedSubject }) =>
      createDraftProofreadingIssue({
        description: `件名は ${DRAFT_SUBJECT_WARNING_LENGTH} 文字以内を目安にすると一覧で読みやすくなります。`,
        excerpt: trimmedSubject,
        field: "subject",
        ruleId: "subject.length",
        severity: "info",
        title: "件名がやや長めです。",
      }),
    matches: ({ subjectLength, trimmedSubject }) =>
      trimmedSubject.length > 0 && subjectLength > DRAFT_SUBJECT_WARNING_LENGTH,
  },
  {
    createIssue: () =>
      createDraftProofreadingIssue({
        description: "宛名か書き出しのどちらかがあると、メール冒頭の体裁が整います。",
        excerpt: "",
        field: "recipient",
        ruleId: "required.recipient-or-opening",
        severity: "error",
        title: "宛名または書き出しが未入力です。",
      }),
    matches: ({ draft }) => !draft.recipient.trim() && !draft.opening.trim(),
  },
  {
    createIssue: () =>
      createDraftProofreadingIssue({
        description: "本文が空のままだと、要件が伝わりません。",
        excerpt: "",
        field: "body",
        ruleId: "required.body",
        severity: "error",
        title: "本文が未入力です。",
      }),
    matches: ({ draft }) => !draft.body.trim(),
  },
  {
    createIssue: ({ draft }) =>
      createDraftProofreadingIssue({
        description: "結びの一文があると、メール全体の印象が締まります。",
        excerpt: "",
        field: "closing",
        ruleId: "required.closing",
        severity: "warning",
        suggestion: createReplacementSuggestion(
          "closing",
          draft.closing,
          0,
          draft.closing.length,
          "引き続きよろしくお願いいたします。",
          "候補を適用",
        ),
        title: "結びが未入力です。",
      }),
    matches: ({ draft }) => !draft.closing.trim(),
  },
  {
    createIssue: () =>
      createDraftProofreadingIssue({
        description: "署名があると、差出人情報を毎回書き直さずに済みます。",
        excerpt: "",
        field: "signature",
        ruleId: "required.signature",
        severity: "error",
        title: "署名が未設定です。",
      }),
    matches: ({ signature }) => !signature?.body.trim(),
  },
  {
    createIssue: ({ missingVariables }) =>
      createDraftProofreadingIssue({
        description: "差し込み項目に値が入っていないため、プレビューやコピー時にそのまま残ります。",
        excerpt: missingVariables.join(", "),
        field: "body",
        ruleId: "variables.missing",
        severity: "error",
        title: `未置換の変数があります: ${missingVariables.join(", ")}`,
      }),
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

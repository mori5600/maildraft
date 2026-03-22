import type { DraftInput } from "../model";
import { getDraftProofreadingRuleLabel } from "./proofreading-rule-data";

export const DRAFT_SUBJECT_WARNING_LENGTH = 45;

export type DraftProofreadingSeverity = "error" | "warning" | "info";
export type DraftProofreadingDetailedStatus = "idle" | "pending" | "running" | "ready" | "error";

export type DraftProofreadingField =
  | "subject"
  | "recipient"
  | "opening"
  | "body"
  | "closing"
  | "signature";

export type DraftProofreadingEditableField = Extract<
  DraftProofreadingField,
  "subject" | "recipient" | "opening" | "body" | "closing"
>;

export interface DraftProofreadingLocation {
  from: number;
  to: number;
}

export interface DraftProofreadingEdit {
  field: DraftProofreadingField;
  from: number;
  to: number;
  originalText: string;
  replacement: string;
}

export interface DraftProofreadingSuggestion {
  edits: DraftProofreadingEdit[];
  label: string;
}

export interface DraftProofreadingIssue {
  id: string;
  ruleId: string;
  severity: DraftProofreadingSeverity;
  title: string;
  description: string;
  field: DraftProofreadingField;
  excerpt: string;
  location?: DraftProofreadingLocation;
  suggestion?: DraftProofreadingSuggestion;
}

export interface DraftProofreadingWorkerRequest {
  requestId: number;
  draft: DraftInput;
}

export interface DraftProofreadingWorkerResponse {
  requestId: number;
  error?: string;
  issues: DraftProofreadingIssue[];
}

const editableFields = new Set<DraftProofreadingEditableField>([
  "subject",
  "recipient",
  "opening",
  "body",
  "closing",
]);

const severityOrder: Record<DraftProofreadingSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const fieldOrder: Record<DraftProofreadingField, number> = {
  subject: 0,
  recipient: 1,
  opening: 2,
  body: 3,
  closing: 4,
  signature: 5,
};

const DRAFT_PROOFREADING_FIELD_LABELS = {
  subject: "件名",
  recipient: "宛名メモ",
  opening: "書き出し",
  body: "本文",
  closing: "結び",
  signature: "署名",
} satisfies Record<DraftProofreadingField, string>;

const DRAFT_PROOFREADING_SEVERITY_LABELS = {
  error: "error",
  warning: "warning",
  info: "info",
} satisfies Record<DraftProofreadingSeverity, string>;

const DRAFT_PROOFREADING_DETAILED_STATUS_LABEL_RESOLVERS = {
  idle: () => "詳細チェックは現在利用できません。",
  pending: () => "入力停止後に詳細チェックを実行します。",
  running: () => "詳細チェックを実行中です。",
  ready: () => "textlint と prh の詳細チェック結果を反映しています。",
  error: (errorMessage?: string | null) =>
    errorMessage
      ? `詳細チェックを実行できませんでした。(${errorMessage})`
      : "詳細チェックを実行できませんでした。",
} satisfies Record<DraftProofreadingDetailedStatus, (errorMessage?: string | null) => string>;

export function createDraftProofreadingIssueId(
  ruleId: string,
  field: DraftProofreadingField,
  location: DraftProofreadingLocation | undefined,
  excerpt: string,
): string {
  return [
    ruleId,
    field,
    location?.from ?? -1,
    location?.to ?? -1,
    encodeURIComponent(excerpt.slice(0, 48)),
  ].join(":");
}

export function draftProofreadingFieldLabel(field: DraftProofreadingField): string {
  return DRAFT_PROOFREADING_FIELD_LABELS[field];
}

export function draftProofreadingSeverityLabel(severity: DraftProofreadingSeverity): string {
  return DRAFT_PROOFREADING_SEVERITY_LABELS[severity];
}

export function draftProofreadingRuleLabel(ruleId: string): string {
  return getDraftProofreadingRuleLabel(ruleId) ?? ruleId;
}

export function draftProofreadingDetailedStatusLabel(
  status: DraftProofreadingDetailedStatus,
  errorMessage?: string | null,
): string {
  return DRAFT_PROOFREADING_DETAILED_STATUS_LABEL_RESOLVERS[status](errorMessage);
}

export function sortDraftProofreadingIssues(
  issues: DraftProofreadingIssue[],
): DraftProofreadingIssue[] {
  return [...issues].sort((left, right) => {
    const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const fieldDelta = fieldOrder[left.field] - fieldOrder[right.field];
    if (fieldDelta !== 0) {
      return fieldDelta;
    }

    const locationDelta = (left.location?.from ?? -1) - (right.location?.from ?? -1);
    if (locationDelta !== 0) {
      return locationDelta;
    }

    return left.title.localeCompare(right.title, "ja");
  });
}

export function mergeDraftProofreadingIssues(
  ...issueGroups: DraftProofreadingIssue[][]
): DraftProofreadingIssue[] {
  const seen = new Set<string>();
  const merged: DraftProofreadingIssue[] = [];

  for (const issues of issueGroups) {
    for (const issue of issues) {
      const fingerprint = draftProofreadingIssueFingerprint(issue);

      if (seen.has(fingerprint)) {
        continue;
      }

      seen.add(fingerprint);
      merged.push(issue);
    }
  }

  return sortDraftProofreadingIssues(merged);
}

export function applyDraftProofreadingSuggestion(
  draft: DraftInput,
  suggestion: DraftProofreadingSuggestion,
): DraftInput {
  let nextDraft = draft;
  const editsByField = new Map<DraftProofreadingEditableField, DraftProofreadingEdit[]>();

  for (const edit of suggestion.edits) {
    if (!editableFields.has(edit.field as DraftProofreadingEditableField)) {
      continue;
    }

    const field = edit.field as DraftProofreadingEditableField;
    editsByField.set(field, [...(editsByField.get(field) ?? []), edit]);
  }

  for (const [field, edits] of editsByField.entries()) {
    const currentValue = String(nextDraft[field] ?? "");
    let nextValue = currentValue;

    for (const edit of [...edits].sort((left, right) => right.from - left.from)) {
      if (nextValue.slice(edit.from, edit.to) !== edit.originalText) {
        continue;
      }

      nextValue = `${nextValue.slice(0, edit.from)}${edit.replacement}${nextValue.slice(edit.to)}`;
    }

    if (nextValue === currentValue) {
      continue;
    }

    nextDraft = {
      ...nextDraft,
      [field]: nextValue,
    };
  }

  return nextDraft;
}

function draftProofreadingIssueFingerprint(issue: DraftProofreadingIssue): string {
  const suggestionEdits =
    issue.suggestion?.edits
      .map((edit) =>
        [
          edit.field,
          edit.from,
          edit.to,
          encodeURIComponent(edit.originalText),
          encodeURIComponent(edit.replacement),
        ].join(":"),
      )
      .join("|") ?? "";

  return [
    issue.field,
    issue.location?.from ?? -1,
    issue.location?.to ?? -1,
    encodeURIComponent(issue.title),
    encodeURIComponent(issue.excerpt),
    suggestionEdits,
  ].join(":");
}

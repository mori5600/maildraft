import type { DraftInput } from "../model";

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
  signatureBody: string;
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

const ruleLabelById: Record<string, string> = {
  "required.subject": "件名未入力",
  "subject.length": "件名長さ",
  "required.recipient-or-opening": "宛名または書き出し",
  "required.body": "本文未入力",
  "required.closing": "結び未入力",
  "required.signature": "署名未設定",
  "variables.missing": "未置換の変数",
  "whitespace.trailing": "行末スペース",
  "whitespace.multiple": "連続スペース",
  "expression.repeated-line": "重複行",
  "discouraged.understood": "「了解しました」",
  "discouraged.casual-understood": "「わかりました」",
  "discouraged.apology": "「すみません」",
  "discouraged.temporary": "「とりあえず」",
  "honorific.confirm-maybe": "「ご確認いただけますでしょうか」",
  "honorific.visit": "「お伺いさせていただきます」",
  "honorific.view": "「拝見させていただきます」",
  "honorific.see": "「ご覧になられましたら」",
  "max-ten": "読点過多",
  "no-doubled-conjunctive-particle-ga": "逆接表現の重複",
  "no-doubled-conjunction": "接続詞の重複",
  "no-double-negative-ja": "二重否定",
  "no-doubled-joshi": "助詞の重複",
  "sentence-length": "長文",
  "no-dropping-the-ra": "ら抜き言葉",
  "no-mix-dearu-desumasu": "文体混在",
  "no-nfd": "文字正規化の揺れ",
  "no-invalid-control-character": "制御文字",
  "no-zero-width-spaces": "ゼロ幅スペース",
  "no-kangxi-radicals": "互換性の低い漢字",
  prh: "prh 言い換え",
  textlint: "textlint",
};

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
  switch (field) {
    case "subject":
      return "件名";
    case "recipient":
      return "宛名メモ";
    case "opening":
      return "書き出し";
    case "body":
      return "本文";
    case "closing":
      return "結び";
    case "signature":
      return "署名";
  }
}

export function draftProofreadingSeverityLabel(severity: DraftProofreadingSeverity): string {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "info";
  }
}

export function draftProofreadingRuleLabel(ruleId: string): string {
  return ruleLabelById[ruleId] ?? ruleId;
}

export function draftProofreadingDetailedStatusLabel(
  status: DraftProofreadingDetailedStatus,
  errorMessage?: string | null,
): string {
  switch (status) {
    case "idle":
      return "詳細チェックは現在利用できません。";
    case "pending":
      return "入力停止後に詳細チェックを実行します。";
    case "running":
      return "詳細チェックを実行中です。";
    case "ready":
      return "textlint と prh の詳細チェック結果を反映しています。";
    case "error":
      return errorMessage
        ? `詳細チェックを実行できませんでした。(${errorMessage})`
        : "詳細チェックを実行できませんでした。";
  }
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

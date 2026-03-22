import {
  collectMissingVariableNames,
  extractVariableNames,
} from "../../../shared/lib/template-variables";
import type { Signature } from "../../signatures/model";
import type { DraftInput } from "../model";
import {
  createDraftProofreadingIssueId,
  DRAFT_SUBJECT_WARNING_LENGTH,
  type DraftProofreadingEdit,
  type DraftProofreadingEditableField,
  type DraftProofreadingField,
  type DraftProofreadingIssue,
  type DraftProofreadingLocation,
  type DraftProofreadingSuggestion,
  sortDraftProofreadingIssues,
} from "./model";

const repeatedLineFields: DraftProofreadingEditableField[] = ["opening", "body", "closing"];
const textCheckFields: DraftProofreadingEditableField[] = ["subject", "opening", "body", "closing"];

export interface DraftProofreadingPhraseRule {
  description: string;
  phrase: string;
  replacement: string;
  ruleId: string;
}

export const discouragedPhraseRules: DraftProofreadingPhraseRule[] = [
  {
    description: "社外メールではやや砕けた印象になりやすい表現です。",
    phrase: "了解しました",
    replacement: "承知しました",
    ruleId: "discouraged.understood",
  },
  {
    description: "口語寄りのため、ビジネスメールでは丁寧な表現に寄せる方が無難です。",
    phrase: "わかりました",
    replacement: "承知しました",
    ruleId: "discouraged.casual-understood",
  },
  {
    description: "謝意や依頼では、より丁寧な言い換えの方がメール文面になじみます。",
    phrase: "すみません",
    replacement: "恐れ入ります",
    ruleId: "discouraged.apology",
  },
  {
    description: "急ぎでない文面では、曖昧さを避けた表現の方が意図を伝えやすくなります。",
    phrase: "とりあえず",
    replacement: "まずは",
    ruleId: "discouraged.temporary",
  },
];

export const doubleHonorificPhraseRules: DraftProofreadingPhraseRule[] = [
  {
    description: "敬語が重なって見えるため、簡潔な形にすると自然です。",
    phrase: "ご確認いただけますでしょうか",
    replacement: "ご確認いただけますか",
    ruleId: "honorific.confirm-maybe",
  },
  {
    description: "「お伺い」と「させていただく」が重なり、不自然に見えることがあります。",
    phrase: "お伺いさせていただきます",
    replacement: "伺います",
    ruleId: "honorific.visit",
  },
  {
    description: "「拝見」と「させていただく」が重なり、不自然に見えることがあります。",
    phrase: "拝見させていただきます",
    replacement: "拝見いたします",
    ruleId: "honorific.view",
  },
  {
    description: "尊敬表現が重なって見えるため、一般的な形に寄せると自然です。",
    phrase: "ご覧になられましたら",
    replacement: "ご覧になりましたら",
    ruleId: "honorific.see",
  },
];

export function buildDraftProofreadingIssues(
  draft: DraftInput,
  signature: Signature | undefined,
): DraftProofreadingIssue[] {
  const variableNames = extractVariableNames([
    draft.subject,
    draft.recipient,
    draft.opening,
    draft.body,
    draft.closing,
    signature?.body ?? "",
  ]);
  const missingVariables = collectMissingVariableNames(variableNames, draft.variableValues);
  const issues = [
    ...buildRequiredIssues(draft, signature, missingVariables),
    ...buildWhitespaceIssues(draft),
    ...buildRepeatedLineIssues(draft),
    ...buildDiscouragedPhraseIssues(draft),
    ...buildDoubleHonorificIssues(draft),
  ];

  return sortDraftProofreadingIssues(deduplicateIssues(issues));
}

function buildRequiredIssues(
  draft: DraftInput,
  signature: Signature | undefined,
  missingVariables: string[],
): DraftProofreadingIssue[] {
  const issues: DraftProofreadingIssue[] = [];
  const subjectLength = Array.from(draft.subject.trim()).length;

  if (!draft.subject.trim()) {
    issues.push(
      createIssue({
        description: "件名がないと、受信者が要件を判断しにくくなります。",
        excerpt: "",
        field: "subject",
        ruleId: "required.subject",
        severity: "error",
        title: "件名が未入力です。",
      }),
    );
  } else if (subjectLength > DRAFT_SUBJECT_WARNING_LENGTH) {
    issues.push(
      createIssue({
        description: `件名は ${DRAFT_SUBJECT_WARNING_LENGTH} 文字以内を目安にすると一覧で読みやすくなります。`,
        excerpt: draft.subject.trim(),
        field: "subject",
        ruleId: "subject.length",
        severity: "info",
        title: "件名がやや長めです。",
      }),
    );
  }

  if (!draft.recipient.trim() && !draft.opening.trim()) {
    issues.push(
      createIssue({
        description: "宛名か書き出しのどちらかがあると、メール冒頭の体裁が整います。",
        excerpt: "",
        field: "recipient",
        ruleId: "required.recipient-or-opening",
        severity: "error",
        title: "宛名または書き出しが未入力です。",
      }),
    );
  }

  if (!draft.body.trim()) {
    issues.push(
      createIssue({
        description: "本文が空のままだと、要件が伝わりません。",
        excerpt: "",
        field: "body",
        ruleId: "required.body",
        severity: "error",
        title: "本文が未入力です。",
      }),
    );
  }

  if (!draft.closing.trim()) {
    issues.push(
      createIssue({
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
    );
  }

  if (!signature?.body.trim()) {
    issues.push(
      createIssue({
        description: "署名があると、差出人情報を毎回書き直さずに済みます。",
        excerpt: "",
        field: "signature",
        ruleId: "required.signature",
        severity: "error",
        title: "署名が未設定です。",
      }),
    );
  }

  if (missingVariables.length > 0) {
    issues.push(
      createIssue({
        description: "差し込み項目に値が入っていないため、プレビューやコピー時にそのまま残ります。",
        excerpt: missingVariables.join(", "),
        field: "body",
        ruleId: "variables.missing",
        severity: "error",
        title: `未置換の変数があります: ${missingVariables.join(", ")}`,
      }),
    );
  }

  return issues;
}

function buildWhitespaceIssues(draft: DraftInput): DraftProofreadingIssue[] {
  const issues: DraftProofreadingIssue[] = [];

  for (const field of textCheckFields) {
    const text = draft[field];

    for (const match of text.matchAll(/[ \t\u3000]+$/gm)) {
      const matched = match[0];
      const from = match.index ?? 0;
      const to = from + matched.length;

      issues.push(
        createIssue({
          description: "末尾の空白は見た目では分かりづらく、コピー後にも残りやすいです。",
          excerpt: lineExcerpt(text, from, to),
          field,
          location: { from, to },
          ruleId: "whitespace.trailing",
          severity: "warning",
          suggestion: createReplacementSuggestion(field, text, from, to, "", "候補を適用"),
          title: "行末に不要な空白があります。",
        }),
      );
    }

    for (const match of text.matchAll(/ {2,}|\u3000{2,}/g)) {
      const matched = match[0];
      const from = match.index ?? 0;
      const to = from + matched.length;

      if (from === 0 || text[from - 1] === "\n") {
        continue;
      }

      if (to === text.length || text[to] === "\n") {
        continue;
      }

      issues.push(
        createIssue({
          description:
            "連続スペースは意図が伝わりにくいため、通常は 1 文字にそろえる方が安全です。",
          excerpt: excerptWithContext(text, from, to),
          field,
          location: { from, to },
          ruleId: "whitespace.multiple",
          severity: "warning",
          suggestion: createReplacementSuggestion(
            field,
            text,
            from,
            to,
            matched[0] === "　" ? "　" : " ",
            "候補を適用",
          ),
          title: "連続したスペースがあります。",
        }),
      );
    }
  }

  return issues;
}

function buildRepeatedLineIssues(draft: DraftInput): DraftProofreadingIssue[] {
  const issues: DraftProofreadingIssue[] = [];

  for (const field of repeatedLineFields) {
    const text = draft[field];
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
          createIssue({
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
  }

  return issues;
}

function buildDiscouragedPhraseIssues(draft: DraftInput): DraftProofreadingIssue[] {
  const issues: DraftProofreadingIssue[] = [];

  for (const field of textCheckFields) {
    const text = draft[field];

    for (const phrase of discouragedPhraseRules) {
      for (const match of text.matchAll(new RegExp(escapeRegExp(phrase.phrase), "g"))) {
        const from = match.index ?? 0;
        const to = from + phrase.phrase.length;

        issues.push(
          createIssue({
            description: phrase.description,
            excerpt: phrase.phrase,
            field,
            location: { from, to },
            ruleId: phrase.ruleId,
            severity: "warning",
            suggestion: createReplacementSuggestion(
              field,
              text,
              from,
              to,
              phrase.replacement,
              "言い換える",
            ),
            title: "非推奨表現の可能性があります。",
          }),
        );
      }
    }
  }

  return issues;
}

function buildDoubleHonorificIssues(draft: DraftInput): DraftProofreadingIssue[] {
  const issues: DraftProofreadingIssue[] = [];

  for (const field of textCheckFields) {
    const text = draft[field];

    for (const phrase of doubleHonorificPhraseRules) {
      for (const match of text.matchAll(new RegExp(escapeRegExp(phrase.phrase), "g"))) {
        const from = match.index ?? 0;
        const to = from + phrase.phrase.length;

        issues.push(
          createIssue({
            description: phrase.description,
            excerpt: phrase.phrase,
            field,
            location: { from, to },
            ruleId: phrase.ruleId,
            severity: "warning",
            suggestion: createReplacementSuggestion(
              field,
              text,
              from,
              to,
              phrase.replacement,
              "候補を適用",
            ),
            title: "二重敬語の候補があります。",
          }),
        );
      }
    }
  }

  return issues;
}

function createIssue(input: {
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

function createReplacementSuggestion(
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

function deduplicateIssues(issues: DraftProofreadingIssue[]): DraftProofreadingIssue[] {
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

function lineExcerpt(text: string, from: number, to: number): string {
  const lineStart = text.lastIndexOf("\n", from - 1) + 1;
  const nextBreak = text.indexOf("\n", to);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return text.slice(lineStart, lineEnd);
}

function excerptWithContext(text: string, from: number, to: number): string {
  const contextStart = Math.max(0, from - 10);
  const contextEnd = Math.min(text.length, to + 10);
  return text.slice(contextStart, contextEnd);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

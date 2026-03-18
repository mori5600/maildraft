import {
  collectMissingVariableNames,
  extractVariableNames,
  resolveVariableTokens,
  resolveVariableTokensWithNames,
} from "../../shared/lib/template-variables";
import type { DraftInput } from "../drafts/model";
import type { Signature } from "../signatures/model";
import type { TemplateInput } from "../templates/model";

export interface DraftRenderResult {
  checks: string[];
  previewSubject: string;
  previewText: string;
  variableNames: string[];
}

export function buildDraftRenderResult(
  draft: DraftInput,
  signature: Signature | undefined,
): DraftRenderResult {
  const variableValues = draft.variableValues;
  const subjectResult = resolveVariableTokensWithNames(draft.subject, variableValues);
  const recipientResult = resolveVariableTokensWithNames(draft.recipient, variableValues);
  const openingResult = resolveVariableTokensWithNames(draft.opening, variableValues);
  const bodyResult = resolveVariableTokensWithNames(draft.body, variableValues);
  const closingResult = resolveVariableTokensWithNames(draft.closing, variableValues);
  const signatureResult = resolveVariableTokensWithNames(signature?.body ?? "", variableValues);
  const variableNames = mergeVariableNames([
    subjectResult.variableNames,
    recipientResult.variableNames,
    openingResult.variableNames,
    bodyResult.variableNames,
    closingResult.variableNames,
    signatureResult.variableNames,
  ]);
  const missingVariables = collectMissingVariableNames(variableNames, variableValues);

  return {
    checks: buildDraftChecks(draft, signature, missingVariables),
    previewSubject: subjectResult.resolvedText,
    previewText: joinSections([
      recipientResult.resolvedText,
      openingResult.resolvedText,
      bodyResult.resolvedText,
      closingResult.resolvedText,
      signatureResult.resolvedText,
    ]),
    variableNames,
  };
}

export function renderDraftPreview(draft: DraftInput, signature: Signature | undefined): string {
  const variableValues = draft.variableValues;

  return joinSections([
    resolveVariableTokens(draft.recipient, variableValues),
    resolveVariableTokens(draft.opening, variableValues),
    resolveVariableTokens(draft.body, variableValues),
    resolveVariableTokens(draft.closing, variableValues),
    resolveVariableTokens(signature?.body ?? "", variableValues),
  ]);
}

export function renderTemplatePreview(
  template: TemplateInput,
  signature: Signature | undefined,
): string {
  return joinSections([
    template.recipient,
    template.opening,
    template.body,
    template.closing,
    signature?.body ?? "",
  ]);
}

export function collectDraftChecks(draft: DraftInput, signature: Signature | undefined): string[] {
  return buildDraftChecks(
    draft,
    signature,
    collectMissingVariableNames(collectDraftVariableNames(draft, signature), draft.variableValues),
  );
}

export function collectDraftVariableNames(
  draft: DraftInput,
  signature: Signature | undefined,
): string[] {
  return extractVariableNames([
    draft.subject,
    draft.recipient,
    draft.opening,
    draft.body,
    draft.closing,
    signature?.body ?? "",
  ]);
}

export function renderDraftSubject(draft: DraftInput): string {
  return resolveVariableTokens(draft.subject, draft.variableValues);
}

function buildDraftChecks(
  draft: DraftInput,
  signature: Signature | undefined,
  missingVariables: string[],
): string[] {
  const checks: string[] = [];

  if (!draft.subject.trim()) {
    checks.push("件名が未入力です。");
  }

  if (!draft.opening.trim() && !draft.recipient.trim()) {
    checks.push("宛名または書き出しが未入力です。");
  }

  if (!draft.body.trim()) {
    checks.push("本文が未入力です。");
  }

  if (!signature?.body.trim()) {
    checks.push("署名が未設定です。");
  }

  if (missingVariables.length > 0) {
    checks.push(`未置換の変数があります: ${missingVariables.join(", ")}`);
  }

  if (checks.length === 0) {
    checks.push("送信前チェックはすべて通っています。");
  }

  return checks;
}

function joinSections(sections: string[]): string {
  return sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .join("\n\n");
}

function mergeVariableNames(groups: string[][]): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];

  for (const names of groups) {
    for (const name of names) {
      if (found.has(name)) {
        continue;
      }

      found.add(name);
      ordered.push(name);
    }
  }

  return ordered;
}

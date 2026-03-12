import {
  collectMissingVariableNames,
  extractVariableNames,
  resolveVariableTokens,
} from "../../shared/lib/template-variables";
import type { DraftInput } from "../drafts/model";
import type { Signature } from "../signatures/model";
import type { TemplateInput } from "../templates/model";

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
  const checks: string[] = [];
  const variableNames = collectDraftVariableNames(draft, signature);
  const missingVariables = collectMissingVariableNames(variableNames, draft.variableValues);

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

function joinSections(sections: string[]): string {
  return sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .join("\n\n");
}

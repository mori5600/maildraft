import type { DraftInput } from "../drafts/model";
import type { Signature } from "../signatures/model";
import type { TemplateInput } from "../templates/model";

export function renderDraftPreview(draft: DraftInput, signature: Signature | undefined): string {
  return joinSections([
    draft.recipient,
    draft.opening,
    draft.body,
    draft.closing,
    signature?.body ?? "",
  ]);
}

export function renderTemplatePreview(
  template: TemplateInput,
  signature: Signature | undefined,
): string {
  return joinSections([template.opening, template.body, template.closing, signature?.body ?? ""]);
}

export function collectDraftChecks(draft: DraftInput, signature: Signature | undefined): string[] {
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

  const unresolvedTokens = [
    draft.subject,
    draft.opening,
    draft.body,
    draft.closing,
    signature?.body ?? "",
  ].flatMap(findTokens);

  if (unresolvedTokens.length > 0) {
    checks.push(`未置換の変数があります: ${Array.from(new Set(unresolvedTokens)).join(", ")}`);
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

function findTokens(text: string): string[] {
  return text.match(/{{\s*[^}]+\s*}}/g) ?? [];
}

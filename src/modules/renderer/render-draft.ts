import {
  extractVariableNames,
  resolveVariableTokens,
  resolveVariableTokensWithNames,
} from "../../shared/lib/template-variables";
import type { DraftInput } from "../drafts/model";
import { buildDraftProofreadingIssues } from "../drafts/proofreading/build-proofreading-issues";
import type { DraftProofreadingIssue } from "../drafts/proofreading/model";
import type { Signature } from "../signatures/model";
import type { TemplateInput } from "../templates/model";

export interface DraftRenderResult {
  issues: DraftProofreadingIssue[];
  previewSubject: string;
  previewText: string;
  variableNames: string[];
}

/**
 * Builds the derived preview, proofreading issues, and variable list for one draft form.
 *
 * @remarks
 * Variable resolution runs once per section and the collected names are reused for both
 * proofreading and preview output. This keeps editor updates consistent while avoiding duplicate
 * token parsing.
 */
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
  return {
    issues: buildDraftProofreadingIssues(draft, signature),
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
  const issues = buildDraftProofreadingIssues(draft, signature);

  if (issues.length === 0) {
    return ["送信前チェックはすべて通っています。"];
  }

  return issues.map((issue) => issue.title);
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

import {
  collectMissingVariableNames,
  extractVariableNames,
} from "../../../shared/lib/template-variables";
import type { Signature } from "../../signatures/model";
import type { DraftInput } from "../model";
import { buildExpressionIssues } from "./build-expression-issues";
import { buildRequiredIssues } from "./build-required-issues";
import { buildWhitespaceIssues } from "./build-whitespace-issues";
import { type DraftProofreadingIssue, sortDraftProofreadingIssues } from "./model";
import { deduplicateDraftProofreadingIssues } from "./proofreading-issue-factory";
export {
  discouragedPhraseRules,
  doubleHonorificPhraseRules,
  type DraftProofreadingPhraseRule,
} from "./proofreading-rule-data";

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
    ...buildExpressionIssues(draft),
  ];

  return sortDraftProofreadingIssues(deduplicateDraftProofreadingIssues(issues));
}

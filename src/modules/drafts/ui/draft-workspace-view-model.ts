import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import type { Signature } from "../../signatures/model";
import type { DraftInput } from "../model";
import type { DraftProofreadingIssue } from "../proofreading/model";

interface CreateDraftWorkspaceViewModelInput {
  draftForm: DraftInput;
  issues: DraftProofreadingIssue[];
  previewText: string;
  selectedIssueId: string | null;
  showWhitespace: boolean;
  signatures: Signature[];
}

interface DraftWorkspacePreviewDescriptionInput {
  hasMissingSignature: boolean;
  selectedSignature: Signature | undefined;
}

interface DraftWorkspacePreviewDescriptionStrategy {
  matches: (input: DraftWorkspacePreviewDescriptionInput) => boolean;
  resolve: (input: DraftWorkspacePreviewDescriptionInput) => string;
}

const previewDescriptionStrategies: DraftWorkspacePreviewDescriptionStrategy[] = [
  {
    matches: ({ selectedSignature }) => Boolean(selectedSignature),
    resolve: ({ selectedSignature }) => selectedSignature?.name ?? "署名なし",
  },
  {
    matches: ({ hasMissingSignature }) => hasMissingSignature,
    resolve: () => "ゴミ箱の署名を参照中",
  },
];

export function createDraftWorkspaceViewModel({
  draftForm,
  issues,
  previewText,
  selectedIssueId,
  showWhitespace,
  signatures,
}: CreateDraftWorkspaceViewModelInput) {
  const selectedSignature = signatures.find((signature) => signature.id === draftForm.signatureId);
  const hasMissingSignature = Boolean(
    draftForm.signatureId &&
    !signatures.some((signature) => signature.id === draftForm.signatureId),
  );
  const previewDescription = resolvePreviewDescription({
    hasMissingSignature,
    selectedSignature,
  });
  const previewTextTrimmed = previewText.trim();

  return {
    activeIssue: issues.find((issue) => issue.id === selectedIssueId) ?? null,
    canCopyPreview: previewTextTrimmed.length > 0,
    canExpandPreview:
      previewTextTrimmed.length > 0 || draftForm.subject.trim().length > 0 || issues.length > 0,
    previewBodyText:
      (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
      "本文プレビューがここに表示されます。",
    previewDescription,
  };
}

function resolvePreviewDescription(input: DraftWorkspacePreviewDescriptionInput): string {
  return (
    previewDescriptionStrategies.find((strategy) => strategy.matches(input))?.resolve(input) ??
    "署名なし"
  );
}

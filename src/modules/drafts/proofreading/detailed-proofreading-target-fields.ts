import type { DraftInput } from "../model";
import type { DraftProofreadingEditableField } from "./model";

export interface DetailedProofreadingTargetField {
  field: DraftProofreadingEditableField;
  includeTextlintRules: boolean;
  text: string;
}

export function buildDetailedProofreadingTargetFields(
  draft: DraftInput,
): DetailedProofreadingTargetField[] {
  return [
    {
      field: "subject",
      includeTextlintRules: false,
      text: draft.subject,
    },
    {
      field: "opening",
      includeTextlintRules: true,
      text: draft.opening,
    },
    {
      field: "body",
      includeTextlintRules: true,
      text: draft.body,
    },
    {
      field: "closing",
      includeTextlintRules: true,
      text: draft.closing,
    },
  ];
}

import type { Template } from "../templates/model";

export interface Draft {
  id: string;
  title: string;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  templateId: string | null;
  signatureId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftInput {
  id: string;
  title: string;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  templateId: string | null;
  signatureId: string | null;
}

export function createEmptyDraft(defaultSignatureId: string | null): DraftInput {
  return {
    id: crypto.randomUUID(),
    title: "",
    subject: "",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    templateId: null,
    signatureId: defaultSignatureId,
  };
}

export function createDraftFromTemplate(
  template: Template,
  defaultSignatureId: string | null,
): DraftInput {
  return {
    id: crypto.randomUUID(),
    title: template.name,
    subject: template.subject,
    recipient: "",
    opening: template.opening,
    body: template.body,
    closing: template.closing,
    templateId: template.id,
    signatureId: template.signatureId ?? defaultSignatureId,
  };
}

export function applyTemplateToDraft(draft: DraftInput, template: Template): DraftInput {
  return {
    ...draft,
    title: draft.title.trim() || template.name,
    subject: template.subject,
    opening: template.opening,
    body: template.body,
    closing: template.closing,
    templateId: template.id,
    signatureId: template.signatureId ?? draft.signatureId,
  };
}

export function toDraftInput(draft: Draft): DraftInput {
  return {
    id: draft.id,
    title: draft.title,
    subject: draft.subject,
    recipient: draft.recipient,
    opening: draft.opening,
    body: draft.body,
    closing: draft.closing,
    templateId: draft.templateId,
    signatureId: draft.signatureId,
  };
}

export function draftLabel(draft: Pick<DraftInput, "title" | "subject">): string {
  return draft.title.trim() || draft.subject.trim() || "無題の下書き";
}

import type { Template } from "../templates/model";
import type { TemplateInput } from "../templates/model";

export interface DraftHistoryEntry {
  id: string;
  draftId: string;
  title: string;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  templateId: string | null;
  signatureId: string | null;
  variableValues: Record<string, string>;
  recordedAt: string;
}

export interface Draft {
  id: string;
  title: string;
  isPinned: boolean;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  templateId: string | null;
  signatureId: string | null;
  variableValues: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftInput {
  id: string;
  title: string;
  isPinned: boolean;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  templateId: string | null;
  signatureId: string | null;
  variableValues: Record<string, string>;
}

export function createEmptyDraft(defaultSignatureId: string | null): DraftInput {
  return {
    id: crypto.randomUUID(),
    title: "",
    isPinned: false,
    subject: "",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    templateId: null,
    signatureId: defaultSignatureId,
    variableValues: {},
  };
}

export function createDraftFromTemplate(
  template: Template,
  defaultSignatureId: string | null,
): DraftInput {
  return createDraftFromTemplateInput(template, defaultSignatureId);
}

export function createDraftFromTemplateInput(
  template: Pick<
    Template | TemplateInput,
    "id" | "name" | "subject" | "recipient" | "opening" | "body" | "closing" | "signatureId"
  >,
  defaultSignatureId: string | null,
): DraftInput {
  return {
    id: crypto.randomUUID(),
    title: template.name,
    isPinned: false,
    subject: template.subject,
    recipient: template.recipient,
    opening: template.opening,
    body: template.body,
    closing: template.closing,
    templateId: template.id,
    signatureId: template.signatureId ?? defaultSignatureId,
    variableValues: {},
  };
}

export function applyTemplateToDraft(draft: DraftInput, template: Template): DraftInput {
  return {
    ...draft,
    title: draft.title.trim() || template.name,
    subject: template.subject,
    recipient: template.recipient,
    opening: template.opening,
    body: template.body,
    closing: template.closing,
    templateId: template.id,
    signatureId: template.signatureId ?? draft.signatureId,
    variableValues: draft.variableValues,
  };
}

export function duplicateDraftInput(draft: DraftInput): DraftInput {
  return {
    ...draft,
    id: crypto.randomUUID(),
    isPinned: false,
    title: withCopySuffix(draft.title.trim() ? draft.title : draftLabel(draft)),
    variableValues: { ...draft.variableValues },
  };
}

export function toDraftInput(draft: Draft): DraftInput {
  return {
    id: draft.id,
    title: draft.title,
    isPinned: draft.isPinned,
    subject: draft.subject,
    recipient: draft.recipient,
    opening: draft.opening,
    body: draft.body,
    closing: draft.closing,
    templateId: draft.templateId,
    signatureId: draft.signatureId,
    variableValues: draft.variableValues,
  };
}

export function draftLabel(draft: Pick<DraftInput, "title" | "subject">): string {
  return draft.title.trim() || draft.subject.trim() || "無題の下書き";
}

export function toDraftInputFromHistory(entry: DraftHistoryEntry): DraftInput {
  return {
    id: entry.draftId,
    title: entry.title,
    isPinned: false,
    subject: entry.subject,
    recipient: entry.recipient,
    opening: entry.opening,
    body: entry.body,
    closing: entry.closing,
    templateId: entry.templateId,
    signatureId: entry.signatureId,
    variableValues: entry.variableValues,
  };
}

export function draftHasMeaningfulContent(draft: DraftInput): boolean {
  return Boolean(
    draft.title.trim() ||
    draft.subject.trim() ||
    draft.recipient.trim() ||
    draft.opening.trim() ||
    draft.body.trim() ||
    draft.closing.trim() ||
    draft.templateId ||
    Object.values(draft.variableValues).some((value) => value.trim().length > 0),
  );
}

export function draftInputsEqual(left: DraftInput, right: DraftInput | null): boolean {
  if (!right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.title === right.title &&
    left.isPinned === right.isPinned &&
    left.subject === right.subject &&
    left.recipient === right.recipient &&
    left.opening === right.opening &&
    left.body === right.body &&
    left.closing === right.closing &&
    left.templateId === right.templateId &&
    left.signatureId === right.signatureId &&
    variableValuesEqual(left.variableValues, right.variableValues)
  );
}

function variableValuesEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}

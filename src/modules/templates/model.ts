import { tagsEqual } from "../../shared/lib/tags";

export interface Template {
  id: string;
  name: string;
  isPinned: boolean;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  signatureId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInput {
  id: string;
  name: string;
  isPinned: boolean;
  subject: string;
  recipient: string;
  opening: string;
  body: string;
  closing: string;
  signatureId: string | null;
  tags: string[];
}

export const DEFAULT_TEMPLATE_NAME = "新しいテンプレート";

type DraftTemplateSource = {
  body: string;
  closing: string;
  opening: string;
  recipient: string;
  signatureId: string | null;
  subject: string;
  tags: string[];
  title: string;
};

export function createEmptyTemplate(defaultSignatureId: string | null): TemplateInput {
  return {
    id: crypto.randomUUID(),
    name: DEFAULT_TEMPLATE_NAME,
    isPinned: false,
    subject: "",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    signatureId: defaultSignatureId,
    tags: [],
  };
}

export function createTemplateFromDraftInput(draft: DraftTemplateSource): TemplateInput {
  return {
    id: crypto.randomUUID(),
    name: draft.title.trim() || draft.subject.trim() || DEFAULT_TEMPLATE_NAME,
    isPinned: false,
    subject: draft.subject,
    recipient: draft.recipient,
    opening: draft.opening,
    body: draft.body,
    closing: draft.closing,
    signatureId: draft.signatureId,
    tags: [...(draft.tags ?? [])],
  };
}

export function toTemplateInput(template: Template): TemplateInput {
  return {
    id: template.id,
    name: template.name,
    isPinned: template.isPinned,
    subject: template.subject,
    recipient: template.recipient,
    opening: template.opening,
    body: template.body,
    closing: template.closing,
    signatureId: template.signatureId,
    tags: template.tags ?? [],
  };
}

export function duplicateTemplateInput(template: TemplateInput): TemplateInput {
  return {
    ...template,
    id: crypto.randomUUID(),
    isPinned: false,
    name: withCopySuffix(template.name),
    tags: [...(template.tags ?? [])],
  };
}

export function templateHasMeaningfulContent(template: TemplateInput): boolean {
  return Boolean(
    template.isPinned ||
    (template.name.trim() && template.name.trim() !== DEFAULT_TEMPLATE_NAME) ||
    template.subject.trim() ||
    template.recipient.trim() ||
    template.opening.trim() ||
    template.body.trim() ||
    template.closing.trim() ||
    (template.tags?.length ?? 0) > 0,
  );
}

export function templateInputsEqual(left: TemplateInput, right: TemplateInput | null): boolean {
  if (!right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.name === right.name &&
    left.isPinned === right.isPinned &&
    left.subject === right.subject &&
    left.recipient === right.recipient &&
    left.opening === right.opening &&
    left.body === right.body &&
    left.closing === right.closing &&
    left.signatureId === right.signatureId &&
    tagsEqual(left.tags, right.tags)
  );
}

export function templateMatchesPersistedTemplate(
  left: TemplateInput,
  right: Template | null,
): boolean {
  if (!right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.name === right.name &&
    left.isPinned === right.isPinned &&
    left.subject === right.subject &&
    left.recipient === right.recipient &&
    left.opening === right.opening &&
    left.body === right.body &&
    left.closing === right.closing &&
    left.signatureId === right.signatureId &&
    tagsEqual(left.tags, right.tags)
  );
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}

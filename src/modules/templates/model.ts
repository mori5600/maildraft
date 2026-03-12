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
}

export function createEmptyTemplate(defaultSignatureId: string | null): TemplateInput {
  return {
    id: crypto.randomUUID(),
    name: "新しいテンプレート",
    isPinned: false,
    subject: "",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    signatureId: defaultSignatureId,
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
  };
}

export function duplicateTemplateInput(template: TemplateInput): TemplateInput {
  return {
    ...template,
    id: crypto.randomUUID(),
    isPinned: false,
    name: withCopySuffix(template.name),
  };
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}

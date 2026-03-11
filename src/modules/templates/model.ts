export interface Template {
  id: string;
  name: string;
  subject: string;
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
  subject: string;
  opening: string;
  body: string;
  closing: string;
  signatureId: string | null;
}

export function createEmptyTemplate(defaultSignatureId: string | null): TemplateInput {
  return {
    id: crypto.randomUUID(),
    name: "新しいテンプレート",
    subject: "",
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
    subject: template.subject,
    opening: template.opening,
    body: template.body,
    closing: template.closing,
    signatureId: template.signatureId,
  };
}

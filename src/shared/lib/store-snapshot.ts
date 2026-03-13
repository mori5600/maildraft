import { createEmptyDraft, type DraftInput, toDraftInput } from "../../modules/drafts/model";
import {
  createEmptySignature,
  type SignatureInput,
  toSignatureInput,
} from "../../modules/signatures/model";
import {
  createEmptyTemplate,
  type TemplateInput,
  toTemplateInput,
} from "../../modules/templates/model";
import type { StoreSnapshot } from "../types/store";

export function getDefaultSignatureId(snapshot: StoreSnapshot): string | null {
  return (
    snapshot.signatures.find((signature) => signature.isDefault)?.id ??
    snapshot.signatures[0]?.id ??
    null
  );
}

export function pickKnownSignatureId(
  snapshot: StoreSnapshot,
  signatureId: string | null,
): string | null {
  if (
    signatureId &&
    (snapshot.signatures.some((signature) => signature.id === signatureId) ||
      snapshot.trash.signatures.some((entry) => entry.signature.id === signatureId))
  ) {
    return signatureId;
  }

  return getDefaultSignatureId(snapshot);
}

export function pickDraftInput(snapshot: StoreSnapshot, draftId: string | null): DraftInput {
  const existing = snapshot.drafts.find((draft) => draft.id === draftId) ?? snapshot.drafts[0];

  if (!existing) {
    return createEmptyDraft(getDefaultSignatureId(snapshot));
  }

  return toDraftInput(existing);
}

export function pickTemplateInput(
  snapshot: StoreSnapshot,
  templateId: string | null,
): TemplateInput {
  const existing =
    snapshot.templates.find((template) => template.id === templateId) ?? snapshot.templates[0];

  if (!existing) {
    return createEmptyTemplate(getDefaultSignatureId(snapshot));
  }

  return toTemplateInput(existing);
}

export function pickSignatureInput(
  snapshot: StoreSnapshot,
  signatureId: string | null,
): SignatureInput {
  const existing =
    snapshot.signatures.find((signature) => signature.id === signatureId) ?? snapshot.signatures[0];

  if (!existing) {
    return createEmptySignature(snapshot.signatures.length === 0);
  }

  return toSignatureInput(existing);
}

export function templateExists(snapshot: StoreSnapshot, templateId: string | null): boolean {
  return Boolean(
    templateId &&
    (snapshot.templates.some((template) => template.id === templateId) ||
      snapshot.trash.templates.some((entry) => entry.template.id === templateId)),
  );
}

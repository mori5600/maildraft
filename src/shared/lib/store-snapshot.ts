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
import type {
  SaveDraftResult,
  SaveSignatureResult,
  SaveTemplateResult,
  StoreSnapshot,
} from "../types/store";
import { sortDrafts, sortSignatures, sortTemplates } from "./list-sort";

export function getDefaultSignatureId(snapshot: StoreSnapshot): string | null {
  return (
    snapshot.signatures.find((signature) => signature.isDefault)?.id ??
    snapshot.signatures[0]?.id ??
    null
  );
}

/**
 * Falls back to the current default when the referenced signature disappeared.
 */
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

/**
 * Patches one saved draft into the current snapshot.
 *
 * The backend returns history for that draft only.
 */
export function applySavedDraftResult(
  snapshot: StoreSnapshot,
  savedDraft: SaveDraftResult,
): StoreSnapshot {
  const drafts = sortDrafts(upsertById(snapshot.drafts, savedDraft.draft), "recent");
  const draftHistory = [
    ...retainOtherDraftHistory(snapshot, savedDraft.draft.id),
    ...savedDraft.draftHistory,
  ]
    .sort((left, right) => Number(right.recordedAt) - Number(left.recordedAt));

  return {
    ...snapshot,
    drafts,
    draftHistory,
  };
}

/** Patches one saved template into the current snapshot. */
export function applySavedTemplateResult(
  snapshot: StoreSnapshot,
  savedTemplate: SaveTemplateResult,
): StoreSnapshot {
  return {
    ...snapshot,
    templates: sortTemplates(upsertById(snapshot.templates, savedTemplate.template), "recent"),
  };
}

/** Replaces active signatures with the saved result payload. */
export function applySavedSignatureResult(
  snapshot: StoreSnapshot,
  savedSignature: SaveSignatureResult,
): StoreSnapshot {
  return {
    ...snapshot,
    signatures: sortSignatures(savedSignature.signatures, "recent"),
  };
}

function retainOtherDraftHistory(snapshot: StoreSnapshot, draftId: string) {
  return snapshot.draftHistory.filter((entry) => entry.draftId !== draftId);
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const nextIndex = items.findIndex((item) => item.id === nextItem.id);

  if (nextIndex === -1) {
    return [...items, nextItem];
  }

  const nextItems = [...items];
  nextItems[nextIndex] = nextItem;
  return nextItems;
}

import { createEmptyDraft, type DraftInput, toDraftInput } from "../../modules/drafts/model";
import { createEmptyMemo, type Memo, type MemoInput, toMemoInput } from "../../modules/memo/model";
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
  DeleteDraftResult,
  DeleteMemoResult,
  DeleteSignatureResult,
  DeleteTemplateResult,
  SaveDraftResult,
  SaveSignatureResult,
  SaveTemplateResult,
  StoreSnapshot,
  TrashMutationResult,
  VariablePresetResult,
} from "../types/store";
import { sortDrafts, sortMemos, sortSignatures, sortTemplates } from "./list-sort";

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

export function pickMemoInput(snapshot: StoreSnapshot, memoId: string | null): MemoInput {
  const existing = snapshot.memos.find((memo) => memo.id === memoId) ?? snapshot.memos[0];

  if (!existing) {
    return createEmptyMemo();
  }

  return toMemoInput(existing);
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

/** Moves one deleted draft into trash without replacing unrelated snapshot data. */
export function applyDeletedDraftResult(
  snapshot: StoreSnapshot,
  deletedDraft: DeleteDraftResult,
): StoreSnapshot {
  return {
    ...snapshot,
    drafts: snapshot.drafts.filter((draft) => draft.id !== deletedDraft.trashedDraft.draft.id),
    draftHistory: retainOtherDraftHistory(snapshot, deletedDraft.trashedDraft.draft.id),
    trash: {
      ...snapshot.trash,
      drafts: upsertTrashEntry(
        snapshot.trash.drafts,
        deletedDraft.trashedDraft,
        (entry) => entry.draft.id,
      ),
    },
  };
}

/** Restores one draft from trash using the same compact shape as save. */
export function applyRestoredDraftResult(
  snapshot: StoreSnapshot,
  restoredDraft: SaveDraftResult,
): StoreSnapshot {
  const nextSnapshot = applySavedDraftResult(snapshot, restoredDraft);

  return {
    ...nextSnapshot,
    trash: {
      ...nextSnapshot.trash,
      drafts: removeTrashEntry(
        nextSnapshot.trash.drafts,
        restoredDraft.draft.id,
        (entry) => entry.draft.id,
      ),
    },
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

/** Moves one deleted template into trash without replacing unrelated snapshot data. */
export function applyDeletedTemplateResult(
  snapshot: StoreSnapshot,
  deletedTemplate: DeleteTemplateResult,
): StoreSnapshot {
  return {
    ...snapshot,
    templates: snapshot.templates.filter(
      (template) => template.id !== deletedTemplate.trashedTemplate.template.id,
    ),
    trash: {
      ...snapshot.trash,
      templates: upsertTrashEntry(
        snapshot.trash.templates,
        deletedTemplate.trashedTemplate,
        (entry) => entry.template.id,
      ),
    },
  };
}

/** Restores one template from trash using the same compact shape as save. */
export function applyRestoredTemplateResult(
  snapshot: StoreSnapshot,
  restoredTemplate: SaveTemplateResult,
): StoreSnapshot {
  const nextSnapshot = applySavedTemplateResult(snapshot, restoredTemplate);

  return {
    ...nextSnapshot,
    trash: {
      ...nextSnapshot.trash,
      templates: removeTrashEntry(
        nextSnapshot.trash.templates,
        restoredTemplate.template.id,
        (entry) => entry.template.id,
      ),
    },
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

/** Patches one saved memo into the current snapshot. */
export function applySavedMemoResult(snapshot: StoreSnapshot, memo: Memo): StoreSnapshot {
  return {
    ...snapshot,
    memos: sortMemos(upsertById(snapshot.memos, memo), "recent"),
  };
}

/** Moves one deleted memo into trash without replacing unrelated snapshot data. */
export function applyDeletedMemoResult(
  snapshot: StoreSnapshot,
  deletedMemo: DeleteMemoResult,
): StoreSnapshot {
  return {
    ...snapshot,
    memos: snapshot.memos.filter((memo) => memo.id !== deletedMemo.trashedMemo.memo.id),
    trash: {
      ...snapshot.trash,
      memos: upsertTrashEntry(
        snapshot.trash.memos ?? [],
        deletedMemo.trashedMemo,
        (entry) => entry.memo.id,
      ),
    },
  };
}

/** Restores one memo from trash using the same compact shape as save. */
export function applyRestoredMemoResult(snapshot: StoreSnapshot, restoredMemo: Memo): StoreSnapshot {
  const nextSnapshot = applySavedMemoResult(snapshot, restoredMemo);

  return {
    ...nextSnapshot,
    trash: {
      ...nextSnapshot.trash,
      memos: removeTrashEntry(
        nextSnapshot.trash.memos ?? [],
        restoredMemo.id,
        (entry) => entry.memo.id,
      ),
    },
  };
}

/** Replaces active signatures and appends the deleted signature to trash. */
export function applyDeletedSignatureResult(
  snapshot: StoreSnapshot,
  deletedSignature: DeleteSignatureResult,
): StoreSnapshot {
  return {
    ...snapshot,
    signatures: sortSignatures(deletedSignature.signatures, "recent"),
    trash: {
      ...snapshot.trash,
      signatures: upsertTrashEntry(
        snapshot.trash.signatures,
        deletedSignature.trashedSignature,
        (entry) => entry.signature.id,
      ),
    },
  };
}

/** Restores one signature from trash using the same compact shape as save. */
export function applyRestoredSignatureResult(
  snapshot: StoreSnapshot,
  restoredSignature: SaveSignatureResult,
  signatureId: string,
): StoreSnapshot {
  const nextSnapshot = applySavedSignatureResult(snapshot, restoredSignature);

  return {
    ...nextSnapshot,
    trash: {
      ...nextSnapshot.trash,
      signatures: removeTrashEntry(
        nextSnapshot.trash.signatures,
        signatureId,
        (entry) => entry.signature.id,
      ),
    },
  };
}

/** Applies destructive trash updates without replacing unaffected collections. */
export function applyTrashMutationResult(
  snapshot: StoreSnapshot,
  mutation: TrashMutationResult,
): StoreSnapshot {
  return {
    ...snapshot,
    drafts: mutation.drafts ?? snapshot.drafts,
    draftHistory: mutation.draftHistory ?? snapshot.draftHistory,
    templates: mutation.templates ?? snapshot.templates,
    trash: mutation.trash,
  };
}

/** Replaces variable presets without touching unrelated collections. */
export function applyVariablePresetResult(
  snapshot: StoreSnapshot,
  result: VariablePresetResult,
): StoreSnapshot {
  return {
    ...snapshot,
    variablePresets: result.variablePresets,
  };
}

function retainOtherDraftHistory(snapshot: StoreSnapshot, draftId: string) {
  return snapshot.draftHistory.filter((entry) => entry.draftId !== draftId);
}

function removeTrashEntry<T>(
  entries: T[],
  itemId: string,
  getId: (entry: T) => string,
): T[] {
  return entries.filter((entry) => getId(entry) !== itemId);
}

function sortTrashEntries<T extends { deletedAt: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => Number(right.deletedAt) - Number(left.deletedAt));
}

function upsertTrashEntry<T extends { deletedAt: string }>(
  entries: T[],
  nextEntry: T,
  getId: (entry: T) => string,
): T[] {
  return sortTrashEntries([
    nextEntry,
    ...entries.filter((entry) => getId(entry) !== getId(nextEntry)),
  ]);
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

import { type Draft, type DraftHistoryEntry, draftLabel } from "../drafts/model";
import type { Signature } from "../signatures/model";
import type { Template } from "../templates/model";

export interface TrashSnapshot {
  drafts: TrashedDraft[];
  templates: TrashedTemplate[];
  signatures: TrashedSignature[];
}

export interface TrashedDraft {
  draft: Draft;
  history: DraftHistoryEntry[];
  deletedAt: string;
}

export interface TrashedTemplate {
  template: Template;
  deletedAt: string;
}

export interface TrashedSignature {
  signature: Signature;
  deletedAt: string;
}

export type TrashItem =
  | {
      kind: "draft";
      key: string;
      deletedAt: string;
      label: string;
      draft: Draft;
      history: DraftHistoryEntry[];
    }
  | {
      kind: "template";
      key: string;
      deletedAt: string;
      label: string;
      template: Template;
    }
  | {
      kind: "signature";
      key: string;
      deletedAt: string;
      label: string;
      signature: Signature;
    };

/**
 * Flattens trash and sorts newest deletions first.
 */
export function collectTrashItems(trash: TrashSnapshot): TrashItem[] {
  return [
    ...trash.drafts.map((entry) => ({
      kind: "draft" as const,
      key: buildTrashItemKey("draft", entry.draft.id),
      deletedAt: entry.deletedAt,
      label: draftLabel(entry.draft),
      draft: entry.draft,
      history: entry.history,
    })),
    ...trash.templates.map((entry) => ({
      kind: "template" as const,
      key: buildTrashItemKey("template", entry.template.id),
      deletedAt: entry.deletedAt,
      label: entry.template.name.trim() || "無題のテンプレート",
      template: entry.template,
    })),
    ...trash.signatures.map((entry) => ({
      kind: "signature" as const,
      key: buildTrashItemKey("signature", entry.signature.id),
      deletedAt: entry.deletedAt,
      label: entry.signature.name.trim() || "無題の署名",
      signature: entry.signature,
    })),
  ].sort((left, right) => Number(right.deletedAt) - Number(left.deletedAt));
}

export function buildTrashItemKey(kind: TrashItem["kind"], itemId: string): string {
  return `${kind}:${itemId}`;
}

export function trashItemTypeLabel(kind: TrashItem["kind"]): string {
  switch (kind) {
    case "draft":
      return "下書き";
    case "template":
      return "テンプレート";
    case "signature":
      return "署名";
  }
}

/**
 * Looks in active signatures first, then in trashed signatures.
 */
export function findTrashSignature(
  signatures: Signature[],
  trashedSignatures: TrashedSignature[],
  signatureId: string | null,
): Signature | undefined {
  if (!signatureId) {
    return undefined;
  }

  return (
    signatures.find((signature) => signature.id === signatureId) ??
    trashedSignatures.find((entry) => entry.signature.id === signatureId)?.signature
  );
}

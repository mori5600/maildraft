import { type Draft, draftLabel } from "../../modules/drafts/model";
import { type Memo, memoLabel } from "../../modules/memo/model";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";

export type DraftSortOption = "recent" | "oldest" | "label";
export type MemoSortOption = "recent" | "oldest" | "label";
export type TemplateSortOption = "recent" | "oldest" | "name";
export type SignatureSortOption = "recent" | "oldest" | "name";

export const DRAFT_SORT_OPTIONS: Array<{ value: DraftSortOption; label: string }> = [
  { value: "recent", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "label", label: "名前順" },
];

export const TEMPLATE_SORT_OPTIONS: Array<{ value: TemplateSortOption; label: string }> = [
  { value: "recent", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "name", label: "名前順" },
];

export const MEMO_SORT_OPTIONS: Array<{ value: MemoSortOption; label: string }> = [
  { value: "recent", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "label", label: "タイトル順" },
];

export const SIGNATURE_SORT_OPTIONS: Array<{ value: SignatureSortOption; label: string }> = [
  { value: "recent", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "name", label: "名前順" },
];

const JA_TEXT_COLLATOR = new Intl.Collator("ja");

export function sortDrafts(drafts: Draft[], sort: DraftSortOption): Draft[] {
  return [...drafts].sort(
    (left, right) =>
      comparePinned(left.isPinned, right.isPinned) || compareDraft(left, right, sort),
  );
}

export function sortTemplates(templates: Template[], sort: TemplateSortOption): Template[] {
  return [...templates].sort(
    (left, right) =>
      comparePinned(left.isPinned, right.isPinned) || compareTemplate(left, right, sort),
  );
}

export function sortMemos(memos: Memo[], sort: MemoSortOption): Memo[] {
  return [...memos].sort(
    (left, right) =>
      comparePinned(left.isPinned, right.isPinned) || compareMemo(left, right, sort),
  );
}

export function sortSignatures(signatures: Signature[], sort: SignatureSortOption): Signature[] {
  return [...signatures].sort(
    (left, right) =>
      comparePinned(left.isPinned, right.isPinned) || compareSignature(left, right, sort),
  );
}

function comparePinned(left: boolean, right: boolean): number {
  return Number(right) - Number(left);
}

function compareDraft(left: Draft, right: Draft, sort: DraftSortOption): number {
  switch (sort) {
    case "oldest":
      return compareTimestamp(left.updatedAt, right.updatedAt);
    case "label":
      return (
        compareText(draftLabel(left), draftLabel(right)) ||
        compareTimestamp(right.updatedAt, left.updatedAt)
      );
    case "recent":
    default:
      return compareTimestamp(right.updatedAt, left.updatedAt);
  }
}

function compareTemplate(left: Template, right: Template, sort: TemplateSortOption): number {
  switch (sort) {
    case "oldest":
      return compareTimestamp(left.updatedAt, right.updatedAt);
    case "name":
      return (
        compareText(left.name, right.name) || compareTimestamp(right.updatedAt, left.updatedAt)
      );
    case "recent":
    default:
      return compareTimestamp(right.updatedAt, left.updatedAt);
  }
}

function compareMemo(left: Memo, right: Memo, sort: MemoSortOption): number {
  switch (sort) {
    case "oldest":
      return compareTimestamp(left.updatedAt, right.updatedAt);
    case "label":
      return (
        compareText(memoLabel(left), memoLabel(right)) ||
        compareTimestamp(right.updatedAt, left.updatedAt)
      );
    case "recent":
    default:
      return compareTimestamp(right.updatedAt, left.updatedAt);
  }
}

function compareSignature(left: Signature, right: Signature, sort: SignatureSortOption): number {
  switch (sort) {
    case "oldest":
      return compareTimestamp(left.updatedAt, right.updatedAt);
    case "name":
      return (
        compareText(left.name, right.name) || compareTimestamp(right.updatedAt, left.updatedAt)
      );
    case "recent":
    default:
      return compareTimestamp(right.updatedAt, left.updatedAt);
  }
}

function compareText(left: string, right: string): number {
  return JA_TEXT_COLLATOR.compare(left, right);
}

function compareTimestamp(left: string, right: string): number {
  return Number(left) - Number(right);
}

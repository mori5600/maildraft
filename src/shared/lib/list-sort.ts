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
type SortComparator<Item> = (left: Item, right: Item) => number;

const DRAFT_SORT_COMPARATORS = {
  recent: (left, right) => compareTimestamp(right.updatedAt, left.updatedAt),
  oldest: (left, right) => compareTimestamp(left.updatedAt, right.updatedAt),
  label: (left, right) =>
    compareText(draftLabel(left), draftLabel(right)) ||
    compareTimestamp(right.updatedAt, left.updatedAt),
} satisfies Record<DraftSortOption, SortComparator<Draft>>;

const TEMPLATE_SORT_COMPARATORS = {
  recent: (left, right) => compareTimestamp(right.updatedAt, left.updatedAt),
  oldest: (left, right) => compareTimestamp(left.updatedAt, right.updatedAt),
  name: (left, right) =>
    compareText(left.name, right.name) || compareTimestamp(right.updatedAt, left.updatedAt),
} satisfies Record<TemplateSortOption, SortComparator<Template>>;

const MEMO_SORT_COMPARATORS = {
  recent: (left, right) => compareTimestamp(right.updatedAt, left.updatedAt),
  oldest: (left, right) => compareTimestamp(left.updatedAt, right.updatedAt),
  label: (left, right) =>
    compareText(memoLabel(left), memoLabel(right)) ||
    compareTimestamp(right.updatedAt, left.updatedAt),
} satisfies Record<MemoSortOption, SortComparator<Memo>>;

const SIGNATURE_SORT_COMPARATORS = {
  recent: (left, right) => compareTimestamp(right.updatedAt, left.updatedAt),
  oldest: (left, right) => compareTimestamp(left.updatedAt, right.updatedAt),
  name: (left, right) =>
    compareText(left.name, right.name) || compareTimestamp(right.updatedAt, left.updatedAt),
} satisfies Record<SignatureSortOption, SortComparator<Signature>>;

export function sortDrafts(drafts: Draft[], sort: DraftSortOption): Draft[] {
  return sortPinnedItems(drafts, sort, DRAFT_SORT_COMPARATORS, (draft) => draft.isPinned);
}

export function sortTemplates(templates: Template[], sort: TemplateSortOption): Template[] {
  return sortPinnedItems(
    templates,
    sort,
    TEMPLATE_SORT_COMPARATORS,
    (template) => template.isPinned,
  );
}

export function sortMemos(memos: Memo[], sort: MemoSortOption): Memo[] {
  return sortPinnedItems(memos, sort, MEMO_SORT_COMPARATORS, (memo) => memo.isPinned);
}

export function sortSignatures(signatures: Signature[], sort: SignatureSortOption): Signature[] {
  return sortPinnedItems(
    signatures,
    sort,
    SIGNATURE_SORT_COMPARATORS,
    (signature) => signature.isPinned,
  );
}

function comparePinned(left: boolean, right: boolean): number {
  return Number(right) - Number(left);
}

function sortPinnedItems<Item, SortOption extends string>(
  items: Item[],
  sort: SortOption,
  comparators: Record<SortOption, SortComparator<Item>>,
  isPinned: (item: Item) => boolean,
): Item[] {
  const comparator = comparators[sort];
  return [...items].sort(
    (left, right) => comparePinned(isPinned(left), isPinned(right)) || comparator(left, right),
  );
}

function compareText(left: string, right: string): number {
  return JA_TEXT_COLLATOR.compare(left, right);
}

function compareTimestamp(left: string, right: string): number {
  return Number(left) - Number(right);
}

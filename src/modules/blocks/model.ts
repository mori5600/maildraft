import { tagsEqual } from "../../shared/lib/tags";

export type ContentBlockCategory =
  | "greeting"
  | "request"
  | "thanks"
  | "reminder"
  | "decline"
  | "other";

export interface ContentBlock {
  id: string;
  name: string;
  category: ContentBlockCategory;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlockInput {
  id: string;
  name: string;
  category: ContentBlockCategory;
  body: string;
  tags: string[];
}

export const DEFAULT_CONTENT_BLOCK_NAME = "新しいブロック";

export const CONTENT_BLOCK_CATEGORY_OPTIONS: Array<{
  value: ContentBlockCategory;
  label: string;
}> = [
  { value: "greeting", label: "挨拶" },
  { value: "request", label: "依頼" },
  { value: "thanks", label: "お礼" },
  { value: "reminder", label: "催促" },
  { value: "decline", label: "断り" },
  { value: "other", label: "その他" },
];

const CONTENT_BLOCK_CATEGORY_LABELS = Object.fromEntries(
  CONTENT_BLOCK_CATEGORY_OPTIONS.map((option) => [option.value, option.label] as const),
) as Record<ContentBlockCategory, string>;

export function createEmptyContentBlock(): ContentBlockInput {
  return {
    id: crypto.randomUUID(),
    name: DEFAULT_CONTENT_BLOCK_NAME,
    category: "other",
    body: "",
    tags: [],
  };
}

export function toContentBlockInput(block: ContentBlock): ContentBlockInput {
  return {
    id: block.id,
    name: block.name,
    category: block.category,
    body: block.body,
    tags: block.tags ?? [],
  };
}

export function duplicateContentBlockInput(block: ContentBlockInput): ContentBlockInput {
  return {
    ...block,
    id: crypto.randomUUID(),
    name: withCopySuffix(block.name),
    tags: [...(block.tags ?? [])],
  };
}

export function contentBlockHasMeaningfulContent(block: ContentBlockInput): boolean {
  return Boolean(
    (block.name.trim() && block.name.trim() !== DEFAULT_CONTENT_BLOCK_NAME) ||
    block.body.trim() ||
    (block.tags?.length ?? 0) > 0,
  );
}

export function contentBlockMatchesPersistedBlock(
  left: ContentBlockInput,
  right: ContentBlock | null,
): boolean {
  if (!right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.name === right.name &&
    left.category === right.category &&
    left.body === right.body &&
    tagsEqual(left.tags, right.tags)
  );
}

export function contentBlockLabel(block: Pick<ContentBlockInput, "name" | "body">): string {
  const name = block.name.trim();
  if (name && name !== DEFAULT_CONTENT_BLOCK_NAME) {
    return name;
  }

  const firstLine = block.body
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? "無題のブロック";
}

export function contentBlockCategoryLabel(category: ContentBlockCategory): string {
  return CONTENT_BLOCK_CATEGORY_LABELS[category];
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}

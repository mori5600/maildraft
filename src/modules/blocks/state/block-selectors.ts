import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import { matchesTagFilter } from "../../../shared/lib/tags";
import { type ContentBlock, contentBlockCategoryLabel } from "../model";

export function filterBlocks(
  blocks: ContentBlock[],
  searchQuery: string,
  activeTag: string | null = null,
): ContentBlock[] {
  const searchTokens = createSearchTokens(searchQuery);

  return [...blocks]
    .filter((block) => {
      const matchesSearch =
        searchTokens.length === 0 ||
        matchesSearchTokens(
          searchTokens,
          buildSearchHaystack([
            block.name,
            block.body,
            contentBlockCategoryLabel(block.category),
            ...block.tags,
          ]),
        );

      return matchesSearch && matchesTagFilter(block.tags, activeTag);
    })
    .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
}

export function selectInsertableBlocks(
  blocks: ContentBlock[],
  searchQuery: string,
): ContentBlock[] {
  return filterBlocks(
    blocks.filter((block) => block.body.trim().length > 0),
    searchQuery,
  );
}

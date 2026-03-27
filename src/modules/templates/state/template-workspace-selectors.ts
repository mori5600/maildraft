import { sortTemplates, type TemplateSortOption } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import { matchesTagFilter } from "../../../shared/lib/tags";
import type { Template } from "../model";

export interface TemplateSearchIndexEntry {
  haystack: string;
  template: Template;
}

export function createTemplateSearchIndex(templates: Template[]): TemplateSearchIndexEntry[] {
  return templates.map((template) => ({
    haystack: buildSearchHaystack([
      template.name,
      template.subject,
      template.recipient,
      template.opening,
      template.body,
      template.closing,
      ...template.tags,
    ]),
    template,
  }));
}

export function selectFilteredTemplates(
  searchIndex: TemplateSearchIndexEntry[],
  searchQuery: string,
  activeTag: string | null,
  sort: TemplateSortOption,
): Template[] {
  const searchTokens = createSearchTokens(searchQuery);

  return sortTemplates(
    searchIndex
      .filter(({ haystack, template }) => {
        const matchesSearch =
          searchTokens.length === 0 || matchesSearchTokens(searchTokens, haystack);

        return matchesSearch && matchesTagFilter(template.tags, activeTag);
      })
      .map(({ template }) => template),
    sort,
  );
}

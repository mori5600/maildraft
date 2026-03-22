import { type DraftSortOption, sortDrafts } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import type { Draft, DraftHistoryEntry } from "../model";
import type { DraftProofreadingIssue } from "../proofreading/model";

export interface DraftSearchIndexEntry {
  draft: Draft;
  haystack: string;
}

export function createDraftSearchIndex(drafts: Draft[]): DraftSearchIndexEntry[] {
  return drafts.map((draft) => ({
    draft,
    haystack: buildSearchHaystack([
      draft.title,
      draft.subject,
      draft.recipient,
      draft.opening,
      draft.body,
      draft.closing,
      ...Object.values(draft.variableValues),
    ]),
  }));
}

export function selectFilteredDrafts(
  searchIndex: DraftSearchIndexEntry[],
  searchQuery: string,
  sort: DraftSortOption,
): Draft[] {
  const draftSearchTokens = createSearchTokens(searchQuery);

  return sortDrafts(
    draftSearchTokens.length === 0
      ? searchIndex.map(({ draft }) => draft)
      : searchIndex
          .filter(({ haystack }) => matchesSearchTokens(draftSearchTokens, haystack))
          .map(({ draft }) => draft),
    sort,
  );
}

export function selectDraftHistory(
  draftHistory: DraftHistoryEntry[],
  draftId: string,
): DraftHistoryEntry[] {
  return draftHistory.filter((entry) => entry.draftId === draftId);
}

export function filterVisibleProofreadingIssues(
  issues: DraftProofreadingIssue[],
  ignoredIssueIds: string[],
  disabledRuleIds: string[],
): DraftProofreadingIssue[] {
  const ignoredIssueIdSet = new Set(ignoredIssueIds);
  const disabledRuleIdSet = new Set(disabledRuleIds);

  return issues.filter(
    (issue) => !ignoredIssueIdSet.has(issue.id) && !disabledRuleIdSet.has(issue.ruleId),
  );
}

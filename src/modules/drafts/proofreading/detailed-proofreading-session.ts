import { TextlintKernel } from "@textlint/kernel";

import type { DraftInput } from "../model";
import { resolveDetailedProofreadingExecutionStrategy } from "./detailed-proofreading-execution-strategy";
import { mapDetailedLintMessageToIssue } from "./detailed-proofreading-message-mapper";
import { detailedProofreadingTextPlugins } from "./detailed-proofreading-rule-set";
import {
  buildDetailedProofreadingTargetFields,
  type DetailedProofreadingTargetField,
} from "./detailed-proofreading-target-fields";
import {
  type DraftProofreadingEditableField,
  type DraftProofreadingIssue,
  sortDraftProofreadingIssues,
} from "./model";

interface DetailedProofreadingRequest {
  draft: DraftInput;
}

interface DetailedFieldCacheEntry {
  cacheKey: string;
  issues: DraftProofreadingIssue[];
  text: string;
}

export interface DetailedDraftProofreadingSession {
  clear: () => void;
  run: (request: DetailedProofreadingRequest) => Promise<DraftProofreadingIssue[]>;
}

export async function runDetailedDraftProofreading({
  draft,
}: DetailedProofreadingRequest): Promise<DraftProofreadingIssue[]> {
  return createDetailedDraftProofreadingSession().run({ draft });
}

export function createDetailedDraftProofreadingSession(): DetailedDraftProofreadingSession {
  const kernel = new TextlintKernel();
  let cachedIssuesByField = new Map<DraftProofreadingEditableField, DetailedFieldCacheEntry>();

  return {
    clear() {
      cachedIssuesByField.clear();
    },
    async run({ draft }) {
      const nextCache = new Map<DraftProofreadingEditableField, DetailedFieldCacheEntry>();
      const issues: DraftProofreadingIssue[] = [];

      for (const targetField of buildDetailedProofreadingTargetFields(draft)) {
        const executionStrategy = resolveDetailedProofreadingExecutionStrategy(targetField);
        const cachedEntry = cachedIssuesByField.get(targetField.field);

        if (
          cachedEntry &&
          cachedEntry.cacheKey === executionStrategy.cacheKey &&
          cachedEntry.text === targetField.text
        ) {
          nextCache.set(targetField.field, cachedEntry);
          issues.push(...cachedEntry.issues);
          continue;
        }

        if (!targetField.text.trim()) {
          nextCache.set(targetField.field, {
            cacheKey: executionStrategy.cacheKey,
            issues: [],
            text: targetField.text,
          });
          continue;
        }

        const nextIssues = await lintDetailedTargetField(kernel, targetField, executionStrategy);
        nextCache.set(targetField.field, {
          cacheKey: executionStrategy.cacheKey,
          issues: nextIssues,
          text: targetField.text,
        });
        issues.push(...nextIssues);
      }

      cachedIssuesByField = nextCache;

      return sortDraftProofreadingIssues(issues);
    },
  };
}

async function lintDetailedTargetField(
  kernel: TextlintKernel,
  targetField: DetailedProofreadingTargetField,
  executionStrategy = resolveDetailedProofreadingExecutionStrategy(targetField),
): Promise<DraftProofreadingIssue[]> {
  const lintOptions = {
    ext: ".txt",
    filePath: `/virtual/${targetField.field}.txt`,
    plugins: detailedProofreadingTextPlugins,
  };
  const executionPlans = [executionStrategy.primaryRuleSet, ...executionStrategy.fallbackRuleSets];
  let lastError: unknown = new Error("Detailed proofreading strategy exhausted.");

  for (const rules of executionPlans) {
    try {
      const result = await kernel.lintText(targetField.text, {
        ...lintOptions,
        rules,
      });

      return result.messages.map((message) =>
        mapDetailedLintMessageToIssue({
          field: targetField.field,
          message,
          sourceText: targetField.text,
        }),
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

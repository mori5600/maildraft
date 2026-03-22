import type { TextlintKernelRule } from "@textlint/kernel";

import { detailedProofreadingRuleSets } from "./detailed-proofreading-rule-set";
import {
  type DetailedProofreadingStrategy,
  resolveDetailedProofreadingStrategy,
} from "./detailed-proofreading-strategy";
import type { DetailedProofreadingTargetField } from "./detailed-proofreading-target-fields";

export interface DetailedProofreadingExecutionStrategy {
  cacheKey: string;
  fallbackRuleSets: TextlintKernelRule[][];
  primaryRuleSet: TextlintKernelRule[];
}

const detailedExecutionStrategies: DetailedProofreadingStrategy<
  DetailedProofreadingTargetField,
  DetailedProofreadingExecutionStrategy
>[] = [
  {
    matches: ({ includeTextlintRules }) => includeTextlintRules,
    resolve: () => ({
      cacheKey: "with-textlint",
      fallbackRuleSets: [detailedProofreadingRuleSets.prhOnly],
      primaryRuleSet: detailedProofreadingRuleSets.withTextlint,
    }),
  },
];

export function resolveDetailedProofreadingExecutionStrategy(
  targetField: DetailedProofreadingTargetField,
): DetailedProofreadingExecutionStrategy {
  return resolveDetailedProofreadingStrategy(detailedExecutionStrategies, targetField, () => ({
    cacheKey: "prh-only",
    fallbackRuleSets: [],
    primaryRuleSet: detailedProofreadingRuleSets.prhOnly,
  }));
}

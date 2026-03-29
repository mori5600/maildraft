import type { DraftInput } from "./model";
import type { VariablePreset } from "./variable-presets";

export interface VariablePresetRecommendation {
  preset: VariablePreset;
  reasonLabel: string;
}

export interface VariablePresetRecommendationViewModel {
  orderedPresets: VariablePreset[];
  recommendedPresets: VariablePresetRecommendation[];
}

interface RankedVariablePreset {
  preset: VariablePreset;
  score: number;
  reasonLabel: string;
}

const RECENT_USE_SCORE = 100;
const NAME_MATCH_SCORE = 30;
const TAG_MATCH_SCORE = 40;

/**
 * Collects the top presets with a positive recommendation signal for the current draft.
 *
 * @remarks
 * Recommendations are limited to presets that score from recent use, tag overlap, or title and
 * subject similarity. The returned order matches the main preset picker ranking and defaults to at
 * most three items.
 */
export function collectRecommendedVariablePresets(
  variablePresets: VariablePreset[],
  draftForm: DraftInput,
  maxItems = 3,
): VariablePresetRecommendation[] {
  return rankVariablePresets(variablePresets, draftForm)
    .filter((entry) => entry.score > 0)
    .slice(0, maxItems)
    .map(({ preset, reasonLabel }) => ({
      preset,
      reasonLabel,
    }));
}

/**
 * Orders the full preset list by relevance and recency for the current draft context.
 *
 * @remarks
 * This keeps non-recommended presets in the picker, unlike `collectRecommendedVariablePresets`.
 */
export function orderVariablePresetsForDraft(
  variablePresets: VariablePreset[],
  draftForm: DraftInput,
): VariablePreset[] {
  return rankVariablePresets(variablePresets, draftForm).map(({ preset }) => preset);
}

/**
 * Builds the preset picker view model used by the draft preview pane.
 *
 * @remarks
 * This runs the ranking once so the picker list and the recommendation chips stay in sync.
 */
export function buildVariablePresetRecommendationViewModel(
  variablePresets: VariablePreset[],
  draftForm: DraftInput,
  maxRecommendations = 3,
): VariablePresetRecommendationViewModel {
  const rankedPresets = rankVariablePresets(variablePresets, draftForm);

  return {
    orderedPresets: rankedPresets.map(({ preset }) => preset),
    recommendedPresets: rankedPresets
      .filter((entry) => entry.score > 0)
      .slice(0, maxRecommendations)
      .map(({ preset, reasonLabel }) => ({
        preset,
        reasonLabel,
      })),
  };
}

function rankVariablePresets(
  variablePresets: VariablePreset[],
  draftForm: DraftInput,
): RankedVariablePreset[] {
  const draftTags = new Set(draftForm.tags);
  const draftSearchText = `${draftForm.title} ${draftForm.subject}`;
  const draftTerms = collectSearchTerms([draftForm.title, draftForm.subject]);

  return [...variablePresets]
    .map((preset) => {
      const overlappingTags = preset.tags.filter((tag) => draftTags.has(tag));
      const hasNameMatch = matchesDraftContext(preset.name, draftSearchText, draftTerms);
      const usedRecently = typeof preset.lastUsedAt === "string" && preset.lastUsedAt.length > 0;
      const score =
        (usedRecently ? RECENT_USE_SCORE : 0) +
        (hasNameMatch ? NAME_MATCH_SCORE : 0) +
        overlappingTags.length * TAG_MATCH_SCORE;

      return {
        preset,
        reasonLabel: buildReasonLabel(usedRecently, hasNameMatch, overlappingTags),
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareTimestamp(right.preset.lastUsedAt, left.preset.lastUsedAt) ||
        compareTimestamp(right.preset.updatedAt, left.preset.updatedAt) ||
        left.preset.name.localeCompare(right.preset.name, "ja"),
    );
}

function matchesDraftContext(
  presetName: string,
  draftSearchText: string,
  draftTerms: string[],
): boolean {
  const normalizedPresetName = presetName.trim();
  if (normalizedPresetName.length < 2) {
    return false;
  }

  if (draftSearchText.includes(normalizedPresetName)) {
    return true;
  }

  return draftTerms.some((term) => normalizedPresetName.includes(term));
}

function buildReasonLabel(
  usedRecently: boolean,
  hasNameMatch: boolean,
  overlappingTags: string[],
): string {
  if (usedRecently) {
    return "最近使用";
  }

  if (overlappingTags.length > 0) {
    return `タグ一致: ${overlappingTags[0]}`;
  }

  if (hasNameMatch) {
    return "件名/一覧名に近い";
  }

  return "";
}

function collectSearchTerms(texts: string[]): string[] {
  const uniqueTerms = new Set<string>();

  for (const text of texts) {
    for (const term of text
      .split(/[\s/・,、()（）【】[\]-]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)) {
      uniqueTerms.add(term);
    }
  }

  return [...uniqueTerms];
}

function compareTimestamp(left: string | null, right: string | null): number {
  return Number(left ?? "0") - Number(right ?? "0");
}

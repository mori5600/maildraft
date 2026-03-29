export interface VariablePreset {
  id: string;
  name: string;
  values: Record<string, string>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface VariablePresetInput {
  id: string;
  name: string;
  values: Record<string, string>;
  tags: string[];
}

function toTimestamp(value: string | null): number {
  return Number(value ?? "0");
}

function compareVariablePresetRecency(left: VariablePreset, right: VariablePreset): number {
  const leftRecent = toTimestamp(left.lastUsedAt ?? left.updatedAt);
  const rightRecent = toTimestamp(right.lastUsedAt ?? right.updatedAt);
  const leftUpdatedAt = toTimestamp(left.updatedAt);
  const rightUpdatedAt = toTimestamp(right.updatedAt);

  return (
    rightRecent - leftRecent ||
    rightUpdatedAt - leftUpdatedAt ||
    left.name.localeCompare(right.name, "ja")
  );
}

function pickNewerLastUsedAt(left: string | null, right: string | null): string | null {
  return toTimestamp(left) >= toTimestamp(right) ? left : right;
}

export function applyVariablePresetValues(
  currentValues: Record<string, string>,
  presetValues: Record<string, string>,
  variableNames: string[],
): Record<string, string> {
  const nextValues = { ...currentValues };

  for (const name of variableNames) {
    const presetValue = presetValues[name];
    if (typeof presetValue === "string") {
      nextValues[name] = presetValue;
    }
  }

  return nextValues;
}

export function collectMeaningfulVariableValues(
  variableNames: string[],
  values: Record<string, string>,
): Record<string, string> {
  const collected: Record<string, string> = {};

  for (const name of variableNames) {
    const value = values[name];
    if (typeof value === "string" && value.trim().length > 0) {
      collected[name] = value;
    }
  }

  return collected;
}

export function hasMeaningfulVariableValues(
  variableNames: string[],
  values: Record<string, string>,
): boolean {
  return Object.keys(collectMeaningfulVariableValues(variableNames, values)).length > 0;
}

/**
 * Orders presets by the most recent meaningful activity shown in the picker.
 */
export function sortVariablePresetsByRecent(variablePresets: VariablePreset[]): VariablePreset[] {
  return [...variablePresets].sort(compareVariablePresetRecency);
}

/**
 * Merges compact preset payloads without letting an older usage response overwrite newer state.
 */
export function mergeVariablePresetCollectionsByRecency(
  currentPresets: VariablePreset[],
  incomingPresets: VariablePreset[],
): VariablePreset[] {
  const mergedPresets = new Map(currentPresets.map((preset) => [preset.id, preset]));

  for (const preset of incomingPresets) {
    const currentPreset = mergedPresets.get(preset.id);

    if (!currentPreset) {
      mergedPresets.set(preset.id, preset);
      continue;
    }

    const basePreset =
      toTimestamp(preset.updatedAt) >= toTimestamp(currentPreset.updatedAt)
        ? preset
        : currentPreset;
    mergedPresets.set(preset.id, {
      ...basePreset,
      lastUsedAt: pickNewerLastUsedAt(currentPreset.lastUsedAt, preset.lastUsedAt),
    });
  }

  return sortVariablePresetsByRecent([...mergedPresets.values()]);
}

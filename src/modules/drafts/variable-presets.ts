export interface VariablePreset {
  id: string;
  name: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface VariablePresetInput {
  id: string;
  name: string;
  values: Record<string, string>;
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

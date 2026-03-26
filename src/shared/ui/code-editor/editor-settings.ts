export type EditorIndentStyle = "spaces" | "tabs";

export interface EditorSettings {
  indentStyle: EditorIndentStyle;
  tabSize: number;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  indentStyle: "spaces",
  tabSize: 2,
};

export const EDITOR_TAB_SIZE_MIN = 1;
export const EDITOR_TAB_SIZE_MAX = 8;

export function normalizeEditorSettings(settings?: Partial<EditorSettings>): EditorSettings {
  return {
    indentStyle:
      settings?.indentStyle === "tabs"
        ? "tabs"
        : settings?.indentStyle === "spaces"
          ? "spaces"
          : DEFAULT_EDITOR_SETTINGS.indentStyle,
    tabSize: normalizeEditorTabSize(settings?.tabSize),
  };
}

export function normalizeEditorTabSize(value: number | null | undefined): number {
  const numericValue = typeof value === "number" ? value : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_EDITOR_SETTINGS.tabSize;
  }

  const normalized = Math.trunc(numericValue);
  if (normalized < EDITOR_TAB_SIZE_MIN || normalized > EDITOR_TAB_SIZE_MAX) {
    return DEFAULT_EDITOR_SETTINGS.tabSize;
  }

  return normalized;
}

export function editorIndentUnitText(settings: EditorSettings): string {
  return settings.indentStyle === "tabs" ? "\t" : " ".repeat(settings.tabSize);
}

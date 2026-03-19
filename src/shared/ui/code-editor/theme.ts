import { EditorView } from "@codemirror/view";

export const codeEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "inherit",
    border: "1px solid var(--color-field-border)",
    borderRadius: "7px",
    backgroundColor: "var(--color-field-bg)",
    color: "var(--color-text-strong)",
    transition: "border-color 150ms ease",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--color-field-focus)",
  },
  "&[aria-disabled='true']": {
    opacity: "0.6",
  },
  ".cm-scroller": {
    minHeight: "inherit",
    overflow: "auto",
  },
  ".cm-content": {
    minHeight: "inherit",
    padding: "8px 12px",
    caretColor: "var(--color-text-strong)",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-placeholder": {
    color: "var(--color-text-placeholder)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-selection)",
  },
  "&.cm-focused > .cm-scroller > .cm-cursorLayer .cm-cursor": {
    borderLeftColor: "var(--color-field-focus)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(95, 139, 255, 0.12)",
  },
  ".cm-selectionMatch-main": {
    backgroundColor: "var(--color-selection)",
  },
  ".cm-panels": {
    backgroundColor: "var(--color-panel-bg)",
    color: "var(--color-text)",
  },
  ".cm-panels-top": {
    borderBottom: "1px solid var(--color-panel-border)",
  },
  ".cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    fontSize: "12px",
  },
  ".cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: "var(--color-text-muted)",
  },
  ".cm-search input": {
    minWidth: "120px",
    border: "1px solid var(--color-field-border)",
    borderRadius: "7px",
    backgroundColor: "var(--color-field-bg)",
    color: "var(--color-text-strong)",
    padding: "4px 8px",
  },
  ".cm-search button": {
    border: "1px solid var(--color-button-secondary-border)",
    borderRadius: "7px",
    backgroundColor: "var(--color-button-secondary-bg)",
    color: "var(--color-button-secondary-text)",
    padding: "4px 8px",
    cursor: "pointer",
  },
  ".cm-search button:hover": {
    borderColor: "var(--color-button-secondary-border-hover)",
    backgroundColor: "var(--color-button-secondary-bg-hover)",
  },
  ".cm-search button:disabled": {
    cursor: "not-allowed",
    opacity: "0.5",
  },
});

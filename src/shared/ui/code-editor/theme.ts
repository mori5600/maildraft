import { EditorView } from "@codemirror/view";

export const codeEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "inherit",
    border: "1px solid var(--color-field-border)",
    borderRadius: "7px",
    backgroundColor: "var(--color-field-bg)",
    color: "var(--color-text-strong)",
    transition: "border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--color-field-focus)",
    boxShadow: "0 0 0 1px var(--color-field-focus), 0 0 0 4px var(--color-focus-ring)",
  },
  "&.cm-maildraft-single-line": {
    minHeight: "34px",
  },
  ".cm-scroller": {
    minHeight: "inherit",
    overflow: "auto",
  },
  "&.cm-maildraft-single-line > .cm-scroller": {
    overflowX: "auto",
    overflowY: "hidden",
  },
  ".cm-content": {
    minHeight: "inherit",
    padding: "8px 12px",
    caretColor: "var(--color-text-strong)",
  },
  "&.cm-maildraft-single-line > .cm-scroller > .cm-content": {
    minHeight: "auto",
    whiteSpace: "pre",
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
  ".cm-maildraft-whitespace": {
    color: "transparent",
    position: "relative",
  },
  ".cm-maildraft-whitespace::before": {
    content: "attr(data-marker)",
    color: "var(--color-text-overlay)",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  ".cm-panels": {
    backgroundColor: "var(--color-panel-bg)",
    color: "var(--color-text)",
  },
  ".cm-panel.cm-search": {
    background:
      "linear-gradient(180deg, var(--color-panel-bg) 0%, var(--color-preview-bg) 100%)",
    boxShadow: "inset 0 1px 0 var(--color-panel-highlight)",
  },
  ".cm-panels-top": {
    borderBottom: "1px solid var(--color-panel-border)",
  },
  ".cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 10px",
    padding: "12px",
    fontSize: "12px",
  },
  ".cm-search br": {
    flexBasis: "100%",
    height: "0",
  },
  ".cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    padding: "0 9px",
    border: "1px solid var(--color-panel-border-strong)",
    borderRadius: "999px",
    backgroundColor: "var(--color-field-bg)",
    color: "var(--color-text-muted)",
    letterSpacing: "0.04em",
  },
  ".cm-search input[type=checkbox]": {
    margin: "0",
    accentColor: "var(--color-field-focus)",
  },
  ".cm-search .cm-textfield": {
    minHeight: "30px",
    minWidth: "140px",
    flex: "1 1 180px",
    border: "1px solid var(--color-field-border)",
    borderRadius: "7px",
    backgroundColor: "var(--color-field-bg)",
    color: "var(--color-text-strong)",
    padding: "6px 10px",
    transition: "border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
  },
  ".cm-search .cm-textfield:focus-visible": {
    outline: "none",
    borderColor: "var(--color-field-focus)",
    boxShadow: "0 0 0 1px var(--color-field-focus), 0 0 0 4px var(--color-focus-ring)",
  },
  ".cm-search .cm-button": {
    border: "1px solid var(--color-button-secondary-border)",
    borderRadius: "7px",
    backgroundColor: "var(--color-button-secondary-bg)",
    color: "var(--color-button-secondary-text)",
    minHeight: "30px",
    padding: "0 10px",
    cursor: "pointer",
    transition: "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
  },
  ".cm-search .cm-button:hover": {
    borderColor: "var(--color-button-secondary-border-hover)",
    backgroundColor: "var(--color-button-secondary-bg-hover)",
  },
  ".cm-search .cm-button:focus-visible": {
    outline: "none",
    boxShadow: "0 0 0 1px var(--color-field-focus), 0 0 0 4px var(--color-focus-ring)",
  },
  ".cm-search .cm-button:disabled": {
    cursor: "not-allowed",
    opacity: "0.5",
  },
  ".cm-search [name=close]": {
    marginLeft: "auto",
    border: "1px solid transparent",
    borderRadius: "7px",
    backgroundColor: "transparent",
    color: "var(--color-button-ghost-text)",
    minHeight: "30px",
    minWidth: "30px",
    padding: "0 8px",
    cursor: "pointer",
    transition: "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
  },
  ".cm-search [name=close]:hover": {
    borderColor: "var(--color-button-ghost-border-hover)",
    backgroundColor: "var(--color-button-ghost-bg-hover)",
    color: "var(--color-button-ghost-text-hover)",
  },
  ".cm-search [name=close]:focus-visible": {
    outline: "none",
    boxShadow: "0 0 0 1px var(--color-field-focus), 0 0 0 4px var(--color-focus-ring)",
  },
});

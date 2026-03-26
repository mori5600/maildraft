import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import {
  Compartment,
  countColumn,
  EditorSelection,
  EditorState,
  type Extension,
  type Line,
  RangeSetBuilder,
  type SelectionRange,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  keymap,
  lineNumbers,
  placeholder,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

import { editorIndentUnitText, type EditorSettings } from "./editor-settings";
import { codeEditorTheme } from "./theme";

export interface CodeEditorCompartments {
  contentAttributes: Compartment;
  editorAttributes: Compartment;
  gutter: Compartment;
  indent: Compartment;
  interaction: Compartment;
  layout: Compartment;
  placeholder: Compartment;
  whitespace: Compartment;
}

export interface CodeEditorContentAttributeOptions {
  ariaLabel?: string;
  textClassName?: string;
}

export interface CodeEditorEditorAttributeOptions {
  singleLine?: boolean;
}

export function createCodeEditorCompartments(): CodeEditorCompartments {
  return {
    contentAttributes: new Compartment(),
    editorAttributes: new Compartment(),
    gutter: new Compartment(),
    indent: new Compartment(),
    interaction: new Compartment(),
    layout: new Compartment(),
    placeholder: new Compartment(),
    whitespace: new Compartment(),
  };
}

export function createCodeEditorBaseExtensions(
  onDocumentChange: (value: string) => void,
): Extension[] {
  return [
    codeEditorTheme,
    EditorState.allowMultipleSelections.of(true),
    drawSelection(),
    history(),
    search({ top: true }),
    highlightSelectionMatches({ minSelectionLength: 1 }),
    keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap]),
    tabFocusModeTrackingExtension,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onDocumentChange(update.state.doc.toString());
      }
    }),
  ];
}

export function createCodeEditorPlaceholderExtension(placeholderText?: string): Extension {
  return placeholderText ? placeholder(placeholderText) : [];
}

export function createCodeEditorGutterExtension(showLineNumbers: boolean): Extension {
  return showLineNumbers ? [lineNumbers()] : [];
}

export function createCodeEditorIndentExtension(tabSize: number): Extension {
  return [
    EditorState.tabSize.of(tabSize),
    EditorView.theme({
      "&": {
        tabSize: String(tabSize),
      },
    }),
  ];
}

export function createCodeEditorContentAttributesExtension(
  options: CodeEditorContentAttributeOptions,
): Extension {
  const attrs: Record<string, string> = {};

  if (options.ariaLabel) {
    attrs["aria-label"] = options.ariaLabel;
  }

  if (options.textClassName) {
    attrs.class = options.textClassName;
  }

  return Object.keys(attrs).length > 0 ? EditorView.contentAttributes.of(attrs) : [];
}

export function createCodeEditorEditorAttributesExtension(
  options: CodeEditorEditorAttributeOptions,
): Extension {
  const classNames: string[] = [];

  if (options.singleLine) {
    classNames.push("cm-maildraft-single-line");
  }

  return classNames.length > 0
    ? EditorView.editorAttributes.of({ class: classNames.join(" ") })
    : [];
}

export function createCodeEditorLayoutExtension(options: { singleLine?: boolean }): Extension {
  if (!options.singleLine) {
    return [EditorView.lineWrapping];
  }

  const normalizeClipboardText = (text: string) => text.replace(/\r\n|\r|\n/g, " ");
  const normalizeInputText = (text: string) => {
    if (!/[\r\n]/.test(text)) {
      return text;
    }

    return text.trim().length === 0 ? "" : normalizeClipboardText(text);
  };

  return [
    EditorView.inputHandler.of((view, from, to, text) => {
      const normalizedText = normalizeInputText(text);

      if (normalizedText === text) {
        return false;
      }

      view.dispatch({
        changes: { from, to, insert: normalizedText },
        selection: { anchor: from + normalizedText.length },
      });
      return true;
    }),
    EditorView.clipboardInputFilter.of((text) => normalizeClipboardText(text)),
    keymap.of([
      {
        key: "Enter",
        preventDefault: true,
        run: () => true,
      },
      {
        key: "Shift-Enter",
        preventDefault: true,
        run: () => true,
      },
    ]),
  ];
}

export interface CodeEditorTabOptions {
  editorSettings: EditorSettings;
  singleLine?: boolean;
}

const TAB_FOCUS_MODE_DISABLED = -1;
const TAB_FOCUS_MODE_ENABLED = 0;
const TEMPORARY_TAB_FOCUS_MODE_DURATION_MS = 2000;
const temporaryTabFocusModifierKeys = new Set([
  "Alt",
  "AltGraph",
  "CapsLock",
  "Control",
  "Meta",
  "NumLock",
  "OS",
  "Shift",
]);
const trackedTabFocusModes = new WeakMap<EditorView, number>();

type CodeEditorTabBehavior = "focus" | "soft-indent";

interface CodeEditorTabStrategyInput {
  indentUnitText: string;
  tabSize: number;
}

const tabFocusModeTrackingExtension = ViewPlugin.fromClass(
  class {
    private readonly originalSetTabFocusMode: EditorView["setTabFocusMode"];

    constructor(private readonly view: EditorView) {
      trackedTabFocusModes.set(view, TAB_FOCUS_MODE_DISABLED);
      this.originalSetTabFocusMode = view.setTabFocusMode.bind(view);
      view.setTabFocusMode = (to) => {
        this.originalSetTabFocusMode(to);
        trackedTabFocusModes.set(
          view,
          resolveTrackedTabFocusMode(getTrackedTabFocusMode(view), to),
        );
      };
    }

    destroy() {
      this.view.setTabFocusMode = this.originalSetTabFocusMode;
      trackedTabFocusModes.delete(this.view);
    }
  },
  {
    eventObservers: {
      keydown(event, view) {
        updateTrackedTabFocusModeFromKeydown(view, event);
      },
    },
  },
);

const tabBehaviorStrategies: Record<
  CodeEditorTabBehavior,
  (input: CodeEditorTabStrategyInput) => Extension
> = {
  focus: () => [],
  "soft-indent": ({ indentUnitText, tabSize }) =>
    keymap.of([
      {
        key: "Tab",
        run: createSoftIndentCommand(indentUnitText),
      },
      {
        key: "Shift-Tab",
        run: createSoftOutdentCommand(indentUnitText, tabSize),
      },
    ]),
};

export function createCodeEditorTabExtension(options: CodeEditorTabOptions): Extension {
  const tabBehavior: CodeEditorTabBehavior = options.singleLine ? "focus" : "soft-indent";
  const indentUnitText = editorIndentUnitText(options.editorSettings);

  return tabBehaviorStrategies[tabBehavior]({
    indentUnitText,
    tabSize: options.editorSettings.tabSize,
  });
}

function createSoftIndentCommand(indentUnitText: string): (view: EditorView) => boolean {
  return (view) => {
    if (isTabFocusModeActive(view)) {
      return false;
    }

    const { state, dispatch } = view;
    if (hasIndentedSelection(state)) {
      dispatch(
        state.update({
          changes: buildLineIndentChanges(state, indentUnitText),
        }),
      );
      return true;
    }

    const transactionSpec = state.changeByRange((range) => ({
      changes: {
        from: range.from,
        to: range.to,
        insert: indentUnitText,
      },
      range: EditorSelection.cursor(range.from + indentUnitText.length),
    }));

    dispatch(state.update(transactionSpec));
    return true;
  };
}

function createSoftOutdentCommand(
  indentUnitText: string,
  tabSize: number,
): (view: EditorView) => boolean {
  return (view) => {
    if (isTabFocusModeActive(view)) {
      return false;
    }

    const { state, dispatch } = view;
    const changes = buildLineOutdentChanges(state, indentUnitText, tabSize);

    if (changes.length > 0) {
      dispatch(
        state.update({
          changes,
        }),
      );
    }

    return true;
  };
}

function isTabFocusModeActive(view: EditorView): boolean {
  const tabFocusMode = getTrackedTabFocusMode(view);

  return (
    tabFocusMode > TAB_FOCUS_MODE_DISABLED &&
    (tabFocusMode === TAB_FOCUS_MODE_ENABLED || Date.now() <= tabFocusMode)
  );
}

function getTrackedTabFocusMode(view: EditorView): number {
  return trackedTabFocusModes.get(view) ?? TAB_FOCUS_MODE_DISABLED;
}

function resolveTrackedTabFocusMode(currentTabFocusMode: number, to?: boolean | number): number {
  if (typeof to === "boolean") {
    return to ? TAB_FOCUS_MODE_ENABLED : TAB_FOCUS_MODE_DISABLED;
  }

  if (typeof to === "number") {
    return currentTabFocusMode === TAB_FOCUS_MODE_ENABLED
      ? TAB_FOCUS_MODE_ENABLED
      : Date.now() + to;
  }

  return currentTabFocusMode < TAB_FOCUS_MODE_ENABLED
    ? TAB_FOCUS_MODE_ENABLED
    : TAB_FOCUS_MODE_DISABLED;
}

function updateTrackedTabFocusModeFromKeydown(view: EditorView, event: KeyboardEvent): void {
  const trackedTabFocusMode = getTrackedTabFocusMode(view);

  if (event.key === "Escape") {
    if (trackedTabFocusMode !== TAB_FOCUS_MODE_ENABLED) {
      trackedTabFocusModes.set(view, Date.now() + TEMPORARY_TAB_FOCUS_MODE_DURATION_MS);
    }
    return;
  }

  if (
    trackedTabFocusMode > TAB_FOCUS_MODE_ENABLED &&
    (Date.now() > trackedTabFocusMode || event.key !== "Tab") &&
    !temporaryTabFocusModifierKeys.has(event.key)
  ) {
    trackedTabFocusModes.set(view, TAB_FOCUS_MODE_DISABLED);
  }
}

function hasIndentedSelection(state: EditorState): boolean {
  return state.selection.ranges.some((range) => !range.empty);
}

function buildLineIndentChanges(
  state: EditorState,
  indentUnitText: string,
): Array<{ from: number; insert: string }> {
  return collectSelectedLines(state).map((line) => ({
    from: line.from,
    insert: indentUnitText,
  }));
}

function buildLineOutdentChanges(
  state: EditorState,
  indentUnitText: string,
  tabSize: number,
): Array<{ from: number; to: number; insert: string }> {
  return collectSelectedLines(state)
    .map((line) => {
      const removableIndentLength = getRemovableIndentLength(line.text, indentUnitText, tabSize);

      return removableIndentLength > 0
        ? {
            from: line.from,
            to: line.from + removableIndentLength,
            insert: "",
          }
        : null;
    })
    .filter((change): change is { from: number; to: number; insert: string } => change !== null);
}

function collectSelectedLines(state: EditorState): Line[] {
  const lineStarts = new Set<number>();
  const lines: Line[] = [];

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(getSelectedRangeEnd(range));

    for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
      const line = state.doc.line(lineNumber);

      if (lineStarts.has(line.from)) {
        continue;
      }

      lineStarts.add(line.from);
      lines.push(line);
    }
  }

  return lines;
}

function getSelectedRangeEnd(range: SelectionRange): number {
  if (range.empty) {
    return range.to;
  }

  return Math.max(range.from, range.to - 1);
}

function getRemovableIndentLength(text: string, indentUnitText: string, tabSize: number): number {
  if (text.startsWith(indentUnitText)) {
    return indentUnitText.length;
  }

  const maxRemovableLength = getIndentWidth(indentUnitText, tabSize);

  if (text.startsWith("\t")) {
    return 1;
  }

  return Math.min(countLeadingSpaces(text), maxRemovableLength);
}

function countLeadingSpaces(text: string): number {
  let count = 0;

  for (const character of text) {
    if (character !== " ") {
      break;
    }

    count += 1;
  }

  return count;
}

function getIndentWidth(indentUnitText: string, tabSize: number): number {
  return countColumn(indentUnitText, tabSize);
}

const visibleWhitespaceMarks = {
  fullWidthSpace: Decoration.mark({
    attributes: {
      class: "cm-maildraft-whitespace",
      "data-marker": "□",
    },
  }),
  space: Decoration.mark({
    attributes: {
      class: "cm-maildraft-whitespace",
      "data-marker": "·",
    },
  }),
};

function buildVisibleWhitespaceDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === " ") {
        builder.add(from + index, from + index + 1, visibleWhitespaceMarks.space);
      } else if (character === "\u3000") {
        builder.add(from + index, from + index + 1, visibleWhitespaceMarks.fullWidthSpace);
      }
    }
  }

  return builder.finish();
}

const visibleWhitespacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildVisibleWhitespaceDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildVisibleWhitespaceDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

export function createCodeEditorWhitespaceExtension(showWhitespace: boolean): Extension {
  return showWhitespace ? [visibleWhitespacePlugin] : [];
}

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
  type StateCommand,
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

import { codeEditorTheme } from "./theme";

export interface CodeEditorCompartments {
  contentAttributes: Compartment;
  editorAttributes: Compartment;
  gutter: Compartment;
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
  singleLine?: boolean;
}

const DEFAULT_SOFT_TAB_TEXT = "  ";

type CodeEditorTabBehavior = "focus" | "soft-indent";

interface CodeEditorTabStrategyInput {
  softTabText: string;
}

const tabBehaviorStrategies: Record<
  CodeEditorTabBehavior,
  (input: CodeEditorTabStrategyInput) => Extension
> = {
  focus: () => [],
  "soft-indent": ({ softTabText }) =>
    keymap.of([
      {
        key: "Tab",
        preventDefault: true,
        run: createSoftIndentCommand(softTabText),
      },
      {
        key: "Shift-Tab",
        preventDefault: true,
        run: createSoftOutdentCommand(softTabText),
      },
    ]),
};

export function createCodeEditorTabExtension(options: CodeEditorTabOptions): Extension {
  const tabBehavior: CodeEditorTabBehavior = options.singleLine ? "focus" : "soft-indent";

  return tabBehaviorStrategies[tabBehavior]({
    softTabText: DEFAULT_SOFT_TAB_TEXT,
  });
}

function createSoftIndentCommand(softTabText: string): StateCommand {
  return ({ state, dispatch }) => {
    if (hasIndentedSelection(state)) {
      dispatch(
        state.update({
          changes: buildLineIndentChanges(state, softTabText),
        }),
      );
      return true;
    }

    const transactionSpec = state.changeByRange((range) => ({
      changes: {
        from: range.from,
        to: range.to,
        insert: softTabText,
      },
      range: EditorSelection.cursor(range.from + softTabText.length),
    }));

    dispatch(state.update(transactionSpec));
    return true;
  };
}

function createSoftOutdentCommand(softTabText: string): StateCommand {
  return ({ state, dispatch }) => {
    const changes = buildLineOutdentChanges(state, softTabText);

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

function hasIndentedSelection(state: EditorState): boolean {
  return state.selection.ranges.some((range) => !range.empty);
}

function buildLineIndentChanges(
  state: EditorState,
  softTabText: string,
): Array<{ from: number; insert: string }> {
  return collectSelectedLines(state).map((line) => ({
    from: line.from,
    insert: softTabText,
  }));
}

function buildLineOutdentChanges(
  state: EditorState,
  softTabText: string,
): Array<{ from: number; to: number; insert: string }> {
  return collectSelectedLines(state)
    .map((line) => {
      const removableIndentLength = getRemovableIndentLength(line.text, softTabText);

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

function getRemovableIndentLength(text: string, softTabText: string): number {
  if (text.startsWith(softTabText)) {
    return softTabText.length;
  }

  const maxRemovableLength = getSoftTabWidth(softTabText);

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

function getSoftTabWidth(softTabText: string): number {
  return countColumn(softTabText, softTabText.length);
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

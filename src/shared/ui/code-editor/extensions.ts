import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import {
  Compartment,
  EditorState,
  type Extension,
  RangeSetBuilder,
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

export function createCodeEditorPlaceholderExtension(
  placeholderText?: string,
): Extension {
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

  return classNames.length > 0 ? EditorView.editorAttributes.of({ class: classNames.join(" ") }) : [];
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

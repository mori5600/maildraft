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
  placeholder,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

import { codeEditorTheme } from "./theme";

export interface CodeEditorCompartments {
  accessibility: Compartment;
  contentAttributes: Compartment;
  editable: Compartment;
  placeholder: Compartment;
  whitespace: Compartment;
}

export interface CodeEditorAccessibilityOptions {
  ariaLabel?: string;
  disabled?: boolean;
}

export interface CodeEditorContentAttributeOptions {
  ariaLabel?: string;
  contentClassName?: string;
}

export function createCodeEditorCompartments(): CodeEditorCompartments {
  return {
    accessibility: new Compartment(),
    contentAttributes: new Compartment(),
    editable: new Compartment(),
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
    EditorView.lineWrapping,
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

export function createCodeEditorEditableExtension(options: {
  disabled?: boolean;
  readOnly?: boolean;
}): Extension {
  const editable = !options.readOnly && !options.disabled;

  return [EditorState.readOnly.of(!editable), EditorView.editable.of(editable)];
}

export function createCodeEditorPlaceholderExtension(
  placeholderText?: string,
): Extension {
  return placeholderText ? placeholder(placeholderText) : [];
}

export function createCodeEditorContentAttributesExtension(
  options: CodeEditorContentAttributeOptions,
): Extension {
  const attrs: Record<string, string> = {};

  if (options.ariaLabel) {
    attrs["aria-label"] = options.ariaLabel;
  }

  if (options.contentClassName) {
    attrs.class = options.contentClassName;
  }

  return Object.keys(attrs).length > 0 ? EditorView.contentAttributes.of(attrs) : [];
}

export function createCodeEditorAccessibilityExtension(
  options: CodeEditorAccessibilityOptions,
): Extension {
  const attrs: Record<string, string> = {};

  if (options.disabled) {
    attrs["aria-disabled"] = "true";
  }

  return Object.keys(attrs).length > 0 ? EditorView.editorAttributes.of(attrs) : [];
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

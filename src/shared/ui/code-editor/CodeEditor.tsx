import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useEffectEvent, useRef } from "react";

import { type EditorSettings, normalizeEditorSettings } from "./editor-settings";
import {
  createCodeEditorBaseExtensions,
  createCodeEditorCompartments,
  createCodeEditorContentAttributesExtension,
  createCodeEditorEditorAttributesExtension,
  createCodeEditorGutterExtension,
  createCodeEditorIndentExtension,
  createCodeEditorLayoutExtension,
  createCodeEditorPlaceholderExtension,
  createCodeEditorTabExtension,
  createCodeEditorWhitespaceExtension,
} from "./extensions";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function normalizeEditorText(value: string, singleLine: boolean): string {
  return singleLine ? value.replace(/\r\n|\r|\n/g, " ") : value;
}

/**
 * Defines the controlled contract for the shared CodeMirror editor.
 *
 * @remarks
 * `singleLine` keeps title-like fields on one line by normalizing pasted and external newlines into
 * spaces before the value is persisted back to application state.
 */
export interface CodeEditorProps {
  ariaLabel?: string;
  className?: string;
  editorSettings?: EditorSettings;
  isHighlighted?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  selectionRequest?: {
    from: number;
    key: number;
    to: number;
  } | null;
  showLineNumbers?: boolean;
  showWhitespace?: boolean;
  singleLine?: boolean;
  textClassName?: string;
  value: string;
}

/** Renders the shared CodeMirror editor used by draft, template, and signature forms. */
export function CodeEditor({
  ariaLabel,
  className,
  editorSettings,
  isHighlighted = false,
  textClassName = "mail-editor-text",
  onChange,
  placeholder,
  selectionRequest,
  showLineNumbers = false,
  showWhitespace = false,
  singleLine = false,
  value,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef(createCodeEditorCompartments());
  const normalizedEditorSettings = normalizeEditorSettings(editorSettings);
  const editorIndentStyle = normalizedEditorSettings.indentStyle;
  const editorTabSize = normalizedEditorSettings.tabSize;
  const normalizedValue = normalizeEditorText(value, singleLine);
  const normalizedPlaceholder =
    typeof placeholder === "string" ? normalizeEditorText(placeholder, singleLine) : placeholder;
  const selectionRequestFrom = selectionRequest?.from ?? null;
  const selectionRequestKey = selectionRequest?.key ?? null;
  const selectionRequestTo = selectionRequest?.to ?? null;
  const initialConfigRef = useRef({
    ariaLabel,
    normalizedPlaceholder,
    normalizedValue,
    editorSettings: normalizedEditorSettings,
    showLineNumbers,
    showWhitespace,
    singleLine,
    textClassName,
  });
  const applyingExternalValueRef = useRef(false);
  const emitChange = useEffectEvent((nextValue: string) => {
    const normalizedNextValue = normalizeEditorText(nextValue, singleLine);

    if (applyingExternalValueRef.current && normalizedNextValue === normalizedValue) {
      applyingExternalValueRef.current = false;
      return;
    }

    applyingExternalValueRef.current = false;
    onChange(normalizedNextValue);
  });
  useEffect(() => {
    if (!containerRef.current || viewRef.current) {
      return;
    }

    const initialConfig = initialConfigRef.current;
    const extensions: Extension[] = [
      ...createCodeEditorBaseExtensions(emitChange),
      compartmentsRef.current.editorAttributes.of(
        createCodeEditorEditorAttributesExtension({
          singleLine: initialConfig.singleLine,
        }),
      ),
      compartmentsRef.current.gutter.of(
        createCodeEditorGutterExtension(initialConfig.showLineNumbers),
      ),
      compartmentsRef.current.indent.of(
        createCodeEditorIndentExtension(initialConfig.editorSettings.tabSize),
      ),
      compartmentsRef.current.interaction.of(
        createCodeEditorTabExtension({
          editorSettings: initialConfig.editorSettings,
          singleLine: initialConfig.singleLine,
        }),
      ),
      compartmentsRef.current.contentAttributes.of(
        createCodeEditorContentAttributesExtension({
          ariaLabel: initialConfig.ariaLabel,
          textClassName: initialConfig.textClassName,
        }),
      ),
      compartmentsRef.current.layout.of(
        createCodeEditorLayoutExtension({ singleLine: initialConfig.singleLine }),
      ),
      compartmentsRef.current.placeholder.of(
        createCodeEditorPlaceholderExtension(initialConfig.normalizedPlaceholder),
      ),
      compartmentsRef.current.whitespace.of(
        createCodeEditorWhitespaceExtension(initialConfig.showWhitespace),
      ),
    ];

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialConfig.normalizedValue,
        extensions,
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.editorAttributes.reconfigure(
        createCodeEditorEditorAttributesExtension({ singleLine }),
      ),
    });
  }, [singleLine]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.gutter.reconfigure(
        createCodeEditorGutterExtension(showLineNumbers),
      ),
    });
  }, [showLineNumbers]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.indent.reconfigure(
        createCodeEditorIndentExtension(editorTabSize),
      ),
    });
  }, [editorTabSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.interaction.reconfigure(
        createCodeEditorTabExtension({
          editorSettings: {
            indentStyle: editorIndentStyle,
            tabSize: editorTabSize,
          },
          singleLine,
        }),
      ),
    });
  }, [editorIndentStyle, editorTabSize, singleLine]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.contentAttributes.reconfigure(
        createCodeEditorContentAttributesExtension({ ariaLabel, textClassName }),
      ),
    });
  }, [ariaLabel, textClassName]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.layout.reconfigure(
        createCodeEditorLayoutExtension({ singleLine }),
      ),
    });
  }, [singleLine]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.placeholder.reconfigure(
        createCodeEditorPlaceholderExtension(normalizedPlaceholder),
      ),
    });
  }, [normalizedPlaceholder]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.whitespace.reconfigure(
        createCodeEditorWhitespaceExtension(showWhitespace),
      ),
    });
  }, [showWhitespace]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === normalizedValue) {
      return;
    }

    applyingExternalValueRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: normalizedValue,
      },
    });
  }, [normalizedValue]);

  useEffect(() => {
    const view = viewRef.current;
    if (
      !view ||
      selectionRequestFrom === null ||
      selectionRequestKey === null ||
      selectionRequestTo === null
    ) {
      return;
    }

    const documentLength = view.state.doc.length;
    const from = clamp(selectionRequestFrom, 0, documentLength);
    const to = clamp(selectionRequestTo, from, documentLength);

    view.dom.scrollIntoView?.({
      block: "center",
    });
    view.focus();
    view.dispatch({
      effects: EditorView.scrollIntoView(from, {
        y: "center",
      }),
      selection: from === to ? EditorSelection.single(from) : EditorSelection.range(from, to),
    });
  }, [selectionRequestFrom, selectionRequestKey, selectionRequestTo]);

  return (
    <div
      className={cn(
        "mail-editor-frame w-full overflow-hidden rounded-[7px]",
        isHighlighted &&
          "border-(--color-field-focus) shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-focus-ring)]",
        singleLine ? "min-h-8.5" : "min-h-28",
        className,
      )}
    >
      <div ref={containerRef} style={{ minHeight: "inherit" }} />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

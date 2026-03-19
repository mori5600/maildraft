import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useEffectEvent, useRef } from "react";

import {
  createCodeEditorBaseExtensions,
  createCodeEditorCompartments,
  createCodeEditorContentAttributesExtension,
  createCodeEditorEditorAttributesExtension,
  createCodeEditorLayoutExtension,
  createCodeEditorPlaceholderExtension,
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
  onChange: (value: string) => void;
  placeholder?: string;
  showWhitespace?: boolean;
  singleLine?: boolean;
  textClassName?: string;
  value: string;
}

/** Renders the shared CodeMirror editor used by draft, template, and signature forms. */
export function CodeEditor({
  ariaLabel,
  className,
  textClassName = "mail-editor-text",
  onChange,
  placeholder,
  showWhitespace = false,
  singleLine = false,
  value,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef(createCodeEditorCompartments());
  const normalizedValue = normalizeEditorText(value, singleLine);
  const normalizedPlaceholder =
    typeof placeholder === "string" ? normalizeEditorText(placeholder, singleLine) : placeholder;
  const initialConfigRef = useRef({
    ariaLabel,
    normalizedPlaceholder,
    normalizedValue,
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

  return (
    <div className={cn(singleLine ? "min-h-8.5" : "min-h-28", className)} ref={containerRef} />
  );
}

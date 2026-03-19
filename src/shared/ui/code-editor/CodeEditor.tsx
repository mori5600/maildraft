import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useEffectEvent, useRef } from "react";

import {
  createCodeEditorAccessibilityExtension,
  createCodeEditorBaseExtensions,
  createCodeEditorCompartments,
  createCodeEditorContentAttributesExtension,
  createCodeEditorEditableExtension,
  createCodeEditorLayoutExtension,
  createCodeEditorPlaceholderExtension,
  createCodeEditorWhitespaceExtension,
} from "./extensions";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function normalizeEditorValue(value: string, singleLine: boolean): string {
  if (!singleLine) {
    return value;
  }

  return value.replace(/\r\n|\r|\n/g, " ");
}

/**
 * Wraps CodeMirror as a controlled multiline editor while leaving selection
 * and history inside the editor state.
 */
export function CodeEditor({
  ariaLabel,
  autoFocus = false,
  className,
  contentClassName = "mail-editor-text",
  disabled = false,
  onBlur,
  onChange,
  onFocus,
  placeholder,
  readOnly = false,
  showWhitespace = false,
  singleLine = false,
  value,
}: {
  ariaLabel?: string;
  autoFocus?: boolean;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  showWhitespace?: boolean;
  singleLine?: boolean;
  value: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef(createCodeEditorCompartments());
  const normalizedValue = normalizeEditorValue(value, singleLine);
  const initialConfigRef = useRef({
    ariaLabel,
    autoFocus,
    contentClassName,
    disabled,
    placeholder,
    readOnly,
    showWhitespace,
    singleLine,
    value: normalizedValue,
  });
  const applyingExternalValueRef = useRef(false);
  const emitChange = useEffectEvent((nextValue: string) => {
    const normalizedNextValue = normalizeEditorValue(nextValue, singleLine);

    if (applyingExternalValueRef.current && normalizedNextValue === normalizedValue) {
      applyingExternalValueRef.current = false;
      return;
    }

    applyingExternalValueRef.current = false;
    onChange(normalizedNextValue);
  });
  const emitFocus = useEffectEvent(() => {
    onFocus?.();
  });
  const emitBlur = useEffectEvent(() => {
    onBlur?.();
  });

  useEffect(() => {
    if (!containerRef.current || viewRef.current) {
      return;
    }

    const initialConfig = initialConfigRef.current;
    const extensions: Extension[] = [
      ...createCodeEditorBaseExtensions(emitChange),
      EditorView.domEventHandlers({
        blur: () => {
          emitBlur();
          return false;
        },
        focus: () => {
          emitFocus();
          return false;
        },
      }),
      compartmentsRef.current.accessibility.of(
        createCodeEditorAccessibilityExtension({
          disabled: initialConfig.disabled,
          singleLine: initialConfig.singleLine,
        }),
      ),
      compartmentsRef.current.contentAttributes.of(
        createCodeEditorContentAttributesExtension({
          ariaLabel: initialConfig.ariaLabel,
          contentClassName: initialConfig.contentClassName,
        }),
      ),
      compartmentsRef.current.editable.of(
        createCodeEditorEditableExtension({
          disabled: initialConfig.disabled,
          readOnly: initialConfig.readOnly,
        }),
      ),
      compartmentsRef.current.layout.of(
        createCodeEditorLayoutExtension({ singleLine: initialConfig.singleLine }),
      ),
      compartmentsRef.current.placeholder.of(
        createCodeEditorPlaceholderExtension(initialConfig.placeholder),
      ),
      compartmentsRef.current.whitespace.of(
        createCodeEditorWhitespaceExtension(initialConfig.showWhitespace),
      ),
    ];

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialConfig.value,
        extensions,
      }),
    });

    viewRef.current = view;

    if (initialConfig.autoFocus) {
      view.focus();
    }

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
      effects: compartmentsRef.current.accessibility.reconfigure(
        createCodeEditorAccessibilityExtension({ disabled, singleLine }),
      ),
    });
  }, [disabled, singleLine]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.contentAttributes.reconfigure(
        createCodeEditorContentAttributesExtension({ ariaLabel, contentClassName }),
      ),
    });
  }, [ariaLabel, contentClassName]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.editable.reconfigure(
        createCodeEditorEditableExtension({ disabled, readOnly }),
      ),
    });
  }, [disabled, readOnly]);

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
        createCodeEditorPlaceholderExtension(placeholder),
      ),
    });
  }, [placeholder]);

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

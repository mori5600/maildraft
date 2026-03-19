import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useEffectEvent, useRef } from "react";

import {
  createCodeEditorAccessibilityExtension,
  createCodeEditorBaseExtensions,
  createCodeEditorCompartments,
  createCodeEditorContentAttributesExtension,
  createCodeEditorEditableExtension,
  createCodeEditorPlaceholderExtension,
} from "./extensions";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
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
  value: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef(createCodeEditorCompartments());
  const applyingExternalValueRef = useRef(false);
  const emitChange = useEffectEvent((nextValue: string) => {
    if (applyingExternalValueRef.current && nextValue === value) {
      applyingExternalValueRef.current = false;
      return;
    }

    applyingExternalValueRef.current = false;
    onChange(nextValue);
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
        createCodeEditorAccessibilityExtension({ disabled }),
      ),
      compartmentsRef.current.contentAttributes.of(
        createCodeEditorContentAttributesExtension({ ariaLabel, contentClassName }),
      ),
      compartmentsRef.current.editable.of(
        createCodeEditorEditableExtension({ disabled, readOnly }),
      ),
      compartmentsRef.current.placeholder.of(
        createCodeEditorPlaceholderExtension(placeholder),
      ),
    ];

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions,
      }),
    });

    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    ariaLabel,
    autoFocus,
    contentClassName,
    disabled,
    placeholder,
    readOnly,
    value,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: compartmentsRef.current.accessibility.reconfigure(
        createCodeEditorAccessibilityExtension({ disabled }),
      ),
    });
  }, [disabled]);

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

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    applyingExternalValueRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  }, [value]);

  return <div className={cn("min-h-28", className)} ref={containerRef} />;
}

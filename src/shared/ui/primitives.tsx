import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PropsWithChildren,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import { visualizeWhitespace } from "../lib/whitespace";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function toDisplayText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

type TextControlElement = HTMLInputElement | HTMLTextAreaElement;

interface TextRange {
  start: number;
  end: number;
}

interface LinkedSelectionState {
  activeIndex: number;
  lastValue: string;
  query: string | null;
  ranges: TextRange[];
}

interface MutableValueRef<T> {
  current: T;
}

interface LinkedSelectionUndoEntry {
  selectionState: LinkedSelectionState;
  value: string;
}

function isSelectNextOccurrenceShortcut(
  event: ReactKeyboardEvent<TextControlElement>,
): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "d";
}

function isUndoShortcut(event: ReactKeyboardEvent<TextControlElement>): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z"
  );
}

function isWordCharacter(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}

function expandSelectionToWord(value: string, cursor: number): TextRange | null {
  if (cursor < 0 || cursor > value.length) {
    return null;
  }

  let start = cursor;
  let end = cursor;

  if (start > 0 && isWordCharacter(value[start - 1] ?? "")) {
    start -= 1;
  } else if (!isWordCharacter(value[start] ?? "")) {
    return null;
  }

  while (start > 0 && isWordCharacter(value[start - 1] ?? "")) {
    start -= 1;
  }

  while (end < value.length && isWordCharacter(value[end] ?? "")) {
    end += 1;
  }

  return start === end ? null : { start, end };
}

function rangesEqual(left: TextRange, right: TextRange): boolean {
  return left.start === right.start && left.end === right.end;
}

function findNextOccurrenceRange(
  value: string,
  query: string,
  existingRanges: TextRange[],
  fromIndex: number,
): TextRange | null {
  if (!query) {
    return null;
  }

  const existingStarts = new Set(existingRanges.map((range) => range.start));
  const anchor = existingRanges[Math.min(fromIndex, existingRanges.length - 1)];
  const searchFrom = anchor ? anchor.end : 0;

  let nextStart = value.indexOf(query, searchFrom);
  while (nextStart !== -1) {
    if (!existingStarts.has(nextStart)) {
      return { start: nextStart, end: nextStart + query.length };
    }
    nextStart = value.indexOf(query, nextStart + 1);
  }

  let wrappedStart = value.indexOf(query);
  while (wrappedStart !== -1 && wrappedStart < searchFrom) {
    if (!existingStarts.has(wrappedStart)) {
      return { start: wrappedStart, end: wrappedStart + query.length };
    }
    wrappedStart = value.indexOf(query, wrappedStart + 1);
  }

  return null;
}

function resolveSelectionRange(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextRange | null {
  if (selectionStart !== selectionEnd) {
    return { start: selectionStart, end: selectionEnd };
  }

  return expandSelectionToWord(value, selectionStart);
}

function createLinkedSelectionState(
  value: string,
  range: TextRange,
): LinkedSelectionState {
  return {
    activeIndex: 0,
    lastValue: value,
    query: value.slice(range.start, range.end),
    ranges: [range],
  };
}

function applyEditToRanges(
  value: string,
  ranges: TextRange[],
  replacement: string,
): { ranges: TextRange[]; value: string } {
  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start);
  const nextRanges: TextRange[] = [];
  let nextValue = value;
  let delta = 0;

  for (const range of sortedRanges) {
    const start = range.start + delta;
    const end = range.end + delta;
    nextValue = `${nextValue.slice(0, start)}${replacement}${nextValue.slice(end)}`;
    const caret = start + replacement.length;
    nextRanges.push({ start: caret, end: caret });
    delta += replacement.length - (end - start);
  }

  return { ranges: nextRanges, value: nextValue };
}

function inferReplacementFromChange(
  previousValue: string,
  nextValue: string,
  activeRange: TextRange,
): string | null {
  const before = previousValue.slice(0, activeRange.start);
  const after = previousValue.slice(activeRange.end);

  if (!nextValue.startsWith(before) || !nextValue.endsWith(after)) {
    return null;
  }

  return nextValue.slice(before.length, nextValue.length - after.length);
}

function setControlValue(target: TextControlElement, value: string): void {
  const prototype =
    target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(target, value);
}

function pushLinkedSelectionUndo(
  undoStackRef: MutableValueRef<LinkedSelectionUndoEntry[]>,
  entry: LinkedSelectionUndoEntry,
): void {
  undoStackRef.current = [...undoStackRef.current, entry].slice(-20);
}

function visualizeSegment(value: string, showWhitespace: boolean): string {
  return showWhitespace ? visualizeWhitespace(value) : value;
}

function renderLinkedSelectionContent(
  value: string,
  selectionState: LinkedSelectionState | null,
  showWhitespace: boolean,
): ReactNode {
  if (!selectionState || selectionState.ranges.length === 0) {
    return visualizeSegment(value, showWhitespace) || " ";
  }

  const nodes: ReactNode[] = [];
  const sortedRanges = [...selectionState.ranges].sort((left, right) => left.start - right.start);
  let cursor = 0;

  for (const [index, range] of sortedRanges.entries()) {
    if (cursor < range.start) {
      nodes.push(
        <span
          key={`text-${index}-${cursor}`}
          className={showWhitespace ? undefined : "text-transparent"}
        >
          {visualizeSegment(value.slice(cursor, range.start), showWhitespace)}
        </span>,
      );
    }

    if (range.start === range.end) {
      nodes.push(
        <span
          key={`caret-${index}-${range.start}`}
          className="inline-block h-[1.15em] w-px translate-y-[0.12em] bg-(--color-field-focus)"
        />,
      );
    } else {
      nodes.push(
        <span
          key={`range-${index}-${range.start}`}
          className={`rounded-[3px] bg-(--color-selection) ${
            showWhitespace ? "" : "text-transparent"
          }`}
        >
          {visualizeSegment(value.slice(range.start, range.end), showWhitespace)}
        </span>,
      );
    }

    cursor = range.end;
  }

  if (cursor < value.length) {
    nodes.push(
      <span key={`text-tail-${cursor}`} className={showWhitespace ? undefined : "text-transparent"}>
        {visualizeSegment(value.slice(cursor), showWhitespace)}
      </span>,
    );
  }

  return nodes.length > 0 ? nodes : " ";
}

function handleUndoLinkedSelection(
  event: ReactKeyboardEvent<TextControlElement>,
  linkedSelectionRef: MutableValueRef<LinkedSelectionState | null>,
  pendingSelectionRef: MutableValueRef<TextRange | null>,
  undoStackRef: MutableValueRef<LinkedSelectionUndoEntry[]>,
  applyingProgrammaticChangeRef: MutableValueRef<boolean>,
): boolean {
  if (!isUndoShortcut(event) || undoStackRef.current.length === 0) {
    return false;
  }

  const target = event.currentTarget;
  const nextUndoStack = [...undoStackRef.current];
  const entry = nextUndoStack.pop() ?? null;
  if (!entry) {
    return false;
  }

  event.preventDefault();
  undoStackRef.current = nextUndoStack;
  linkedSelectionRef.current = entry.selectionState;
  pendingSelectionRef.current =
    entry.selectionState.ranges[
      Math.min(entry.selectionState.activeIndex, entry.selectionState.ranges.length - 1)
    ] ?? null;
  applyingProgrammaticChangeRef.current = true;
  setControlValue(target, entry.value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function handleSelectNextOccurrence(
  event: ReactKeyboardEvent<TextControlElement>,
  linkedSelectionRef: MutableValueRef<LinkedSelectionState | null>,
  pendingSelectionRef: MutableValueRef<TextRange | null>,
): void {
  if (!isSelectNextOccurrenceShortcut(event)) {
    return;
  }

  const target = event.currentTarget;
  if (target.readOnly || target.disabled) {
    return;
  }

  const value = target.value;
  const selectionStart = target.selectionStart ?? 0;
  const selectionEnd = target.selectionEnd ?? selectionStart;
  const selection = resolveSelectionRange(value, selectionStart, selectionEnd);

  if (!selection) {
    return;
  }

  event.preventDefault();

  const currentState =
    linkedSelectionRef.current?.lastValue === value ? linkedSelectionRef.current : null;
  if (selectionStart === selectionEnd) {
    linkedSelectionRef.current = createLinkedSelectionState(value, selection);
    pendingSelectionRef.current = selection;
    target.setSelectionRange(selection.start, selection.end);
    return;
  }

  const query = value.slice(selection.start, selection.end);
  const baseState =
    currentState &&
    currentState.query === query &&
    currentState.ranges.some((range) => rangesEqual(range, selection))
      ? {
          ...currentState,
          activeIndex: currentState.ranges.findIndex((range) => rangesEqual(range, selection)),
        }
      : createLinkedSelectionState(value, selection);
  const nextSelection = findNextOccurrenceRange(
    value,
    query,
    baseState.ranges,
    baseState.activeIndex,
  );
  if (!nextSelection) {
    linkedSelectionRef.current = baseState;
    pendingSelectionRef.current = selection;
    target.setSelectionRange(selection.start, selection.end);
    return;
  }

  const nextRanges = [...baseState.ranges, nextSelection].sort((left, right) => left.start - right.start);
  const activeIndex = nextRanges.findIndex((range) => rangesEqual(range, nextSelection));
  linkedSelectionRef.current = {
    activeIndex,
    lastValue: value,
    query,
    ranges: nextRanges,
  };
  pendingSelectionRef.current = nextSelection;
  target.setSelectionRange(nextSelection.start, nextSelection.end);
}

function handleLinkedSelectionChange(
  target: TextControlElement,
  linkedSelectionRef: MutableValueRef<LinkedSelectionState | null>,
  pendingSelectionRef: MutableValueRef<TextRange | null>,
  undoStackRef: MutableValueRef<LinkedSelectionUndoEntry[]>,
): void {
  const state = linkedSelectionRef.current;
  if (!state || state.ranges.length < 2) {
    return;
  }

  const activeRange = state.ranges[Math.min(state.activeIndex, state.ranges.length - 1)];
  if (!activeRange) {
    linkedSelectionRef.current = null;
    return;
  }

  const replacement = inferReplacementFromChange(state.lastValue, target.value, activeRange);
  if (replacement === null) {
    linkedSelectionRef.current = null;
    return;
  }

  pushLinkedSelectionUndo(undoStackRef, {
    selectionState: state,
    value: state.lastValue,
  });
  const applied = applyEditToRanges(state.lastValue, state.ranges, replacement);
  const nextActiveRange = applied.ranges[Math.min(state.activeIndex, applied.ranges.length - 1)] ?? null;
  linkedSelectionRef.current = {
    activeIndex: Math.min(state.activeIndex, Math.max(applied.ranges.length - 1, 0)),
    lastValue: applied.value,
    query: null,
    ranges: applied.ranges,
  };
  pendingSelectionRef.current = nextActiveRange;
  if (applied.value !== target.value) {
    setControlValue(target, applied.value);
  }
}

function syncLinkedSelection(
  target: TextControlElement,
  linkedSelectionRef: MutableValueRef<LinkedSelectionState | null>,
): void {
  const state = linkedSelectionRef.current;
  if (!state) {
    return;
  }

  if (state.lastValue !== target.value) {
    linkedSelectionRef.current = null;
    return;
  }

  const selectionStart = target.selectionStart ?? 0;
  const selectionEnd = target.selectionEnd ?? selectionStart;
  const activeIndex = state.ranges.findIndex(
    (range) => range.start === selectionStart && range.end === selectionEnd,
  );
  if (activeIndex === -1) {
    linkedSelectionRef.current = null;
    return;
  }

  linkedSelectionRef.current = {
    ...state,
    activeIndex,
  };
}

export function Panel({
  children,
  className,
  ...props
}: PropsWithChildren<{ className?: string }> & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) text-(--color-text) shadow-[0_1px_0_rgba(255,255,255,0.02)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const variantClassName =
    variant === "primary"
      ? "border border-(--color-button-primary-border) bg-(--color-button-primary-bg) text-(--color-button-primary-text) hover:border-(--color-button-primary-border-hover) hover:bg-(--color-button-primary-bg-hover)"
      : variant === "danger"
        ? "border border-(--color-button-danger-border) bg-(--color-button-danger-bg) text-(--color-button-danger-text) hover:border-(--color-button-danger-border-hover) hover:bg-(--color-button-danger-bg-hover)"
        : variant === "ghost"
          ? "border border-transparent bg-transparent text-(--color-button-ghost-text) hover:border-(--color-button-ghost-border-hover) hover:bg-(--color-button-ghost-bg-hover) hover:text-(--color-button-ghost-text-hover)"
          : "border border-(--color-button-secondary-border) bg-(--color-button-secondary-bg) text-(--color-button-secondary-text) hover:border-(--color-button-secondary-border-hover) hover:bg-(--color-button-secondary-bg-hover)";

  const sizeClassName =
    size === "sm"
      ? "rounded-[7px] px-2.5 py-1.5 text-[11px] leading-none"
      : "rounded-[7px] px-3 py-[0.55rem] text-[13px] leading-none";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClassName,
        sizeClassName,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-medium tracking-[0.14em] text-(--color-text-subtle) uppercase">
          {label}
        </div>
        {hint ? <div className="text-[11px] text-(--color-text-hint)">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

export function Input({
  className,
  enableSelectNextOccurrence = false,
  onBlur,
  onChange,
  onScroll,
  showWhitespace = false,
  onKeyDown,
  onSelect,
  textClassName,
  value,
  placeholder,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  enableSelectNextOccurrence?: boolean;
  showWhitespace?: boolean;
  textClassName?: string;
}) {
  const displayValue = toDisplayText(value);
  const deferredDisplayValue = useDeferredValue(displayValue);
  const overlayText = deferredDisplayValue || (typeof placeholder === "string" ? placeholder : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const linkedSelectionRef = useRef<LinkedSelectionState | null>(null);
  const [linkedSelectionState, setLinkedSelectionState] = useState<LinkedSelectionState | null>(null);
  const pendingSelectionRef = useRef<TextRange | null>(null);
  const undoStackRef = useRef<LinkedSelectionUndoEntry[]>([]);
  const applyingProgrammaticChangeRef = useRef(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const visibleLinkedSelectionState =
    linkedSelectionState?.lastValue === displayValue ? linkedSelectionState : null;

  useEffect(() => {
    if (linkedSelectionRef.current && linkedSelectionRef.current.lastValue !== displayValue) {
      linkedSelectionRef.current = null;
    }

    const pendingSelection = pendingSelectionRef.current;
    if (!pendingSelection || inputRef.current !== document.activeElement) {
      return;
    }

    inputRef.current?.setSelectionRange(pendingSelection.start, pendingSelection.end);
    pendingSelectionRef.current = null;
  }, [displayValue]);

  return (
    <div className="relative">
      {showWhitespace || visibleLinkedSelectionState ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-[7px] px-3 text-[13px] text-(--color-text-overlay)",
            textClassName,
          )}
        >
          <div
            className="min-w-full whitespace-pre"
            style={{
              transform: `translateX(${-scrollLeft}px)`,
            }}
          >
            {renderLinkedSelectionContent(overlayText, visibleLinkedSelectionState, showWhitespace)}
          </div>
        </div>
      ) : null}
      <input
        ref={inputRef}
        className={cn(
          "w-full rounded-[7px] border border-(--color-field-border) bg-(--color-field-bg) px-3 py-2 text-[13px] text-(--color-text-strong) transition-colors outline-none placeholder:text-(--color-text-placeholder) focus:border-(--color-field-focus)",
          textClassName,
          showWhitespace && "text-transparent caret-(--color-text-strong)",
          className,
        )}
        placeholder={showWhitespace ? "" : placeholder}
        value={value}
        onBlur={(event) => {
          linkedSelectionRef.current = null;
          setLinkedSelectionState(null);
          pendingSelectionRef.current = null;
          undoStackRef.current = [];
          onBlur?.(event);
        }}
        onChange={(event) => {
          if (applyingProgrammaticChangeRef.current) {
            applyingProgrammaticChangeRef.current = false;
            onChange?.(event);
            return;
          }
          if (enableSelectNextOccurrence) {
            handleLinkedSelectionChange(
              event.currentTarget,
              linkedSelectionRef,
              pendingSelectionRef,
              undoStackRef,
            );
            setLinkedSelectionState(linkedSelectionRef.current);
          }
          onChange?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && enableSelectNextOccurrence) {
            if (
              handleUndoLinkedSelection(
                event,
                linkedSelectionRef,
                pendingSelectionRef,
                undoStackRef,
                applyingProgrammaticChangeRef,
              )
            ) {
              setLinkedSelectionState(linkedSelectionRef.current);
              return;
            }

            handleSelectNextOccurrence(event, linkedSelectionRef, pendingSelectionRef);
            setLinkedSelectionState(linkedSelectionRef.current);
          }
        }}
        onSelect={(event) => {
          onSelect?.(event);
          if (enableSelectNextOccurrence) {
            syncLinkedSelection(event.currentTarget, linkedSelectionRef);
            setLinkedSelectionState(linkedSelectionRef.current);
          }
        }}
        onScroll={(event) => {
          setScrollLeft(event.currentTarget.scrollLeft);
          onScroll?.(event);
        }}
        {...props}
      />
    </div>
  );
}

export function Textarea({
  className,
  enableSelectNextOccurrence = false,
  onBlur,
  onChange,
  showWhitespace = false,
  onKeyDown,
  onSelect,
  textClassName,
  value,
  placeholder,
  onScroll,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  enableSelectNextOccurrence?: boolean;
  showWhitespace?: boolean;
  textClassName?: string;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const resolvedTextClassName = textClassName ?? "mail-editor-text";
  const displayValue = toDisplayText(value);
  const deferredDisplayValue = useDeferredValue(displayValue);
  const overlayText = deferredDisplayValue || (typeof placeholder === "string" ? placeholder : "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const linkedSelectionRef = useRef<LinkedSelectionState | null>(null);
  const [linkedSelectionState, setLinkedSelectionState] = useState<LinkedSelectionState | null>(null);
  const pendingSelectionRef = useRef<TextRange | null>(null);
  const undoStackRef = useRef<LinkedSelectionUndoEntry[]>([]);
  const applyingProgrammaticChangeRef = useRef(false);
  const visibleLinkedSelectionState =
    linkedSelectionState?.lastValue === displayValue ? linkedSelectionState : null;

  useEffect(() => {
    if (linkedSelectionRef.current && linkedSelectionRef.current.lastValue !== displayValue) {
      linkedSelectionRef.current = null;
    }

    const pendingSelection = pendingSelectionRef.current;
    if (!pendingSelection || textareaRef.current !== document.activeElement) {
      return;
    }

    textareaRef.current?.setSelectionRange(pendingSelection.start, pendingSelection.end);
    pendingSelectionRef.current = null;
  }, [displayValue]);

  return (
    <div className="relative">
      {showWhitespace || visibleLinkedSelectionState ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-[7px] px-3 py-2 text-(--color-text-overlay)",
            resolvedTextClassName,
          )}
        >
          <pre
            className="min-h-full wrap-break-word whitespace-pre-wrap"
            style={{
              transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
            }}
          >
            {renderLinkedSelectionContent(overlayText, visibleLinkedSelectionState, showWhitespace)}
          </pre>
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        className={cn(
          "min-h-28 w-full rounded-[7px] border border-(--color-field-border) bg-(--color-field-bg) px-3 py-2 text-(--color-text-strong) transition-colors outline-none placeholder:text-(--color-text-placeholder) focus:border-(--color-field-focus)",
          resolvedTextClassName,
          showWhitespace && "text-transparent caret-(--color-text-strong)",
          className,
        )}
        placeholder={showWhitespace ? "" : placeholder}
        value={value}
        onBlur={(event) => {
          linkedSelectionRef.current = null;
          setLinkedSelectionState(null);
          pendingSelectionRef.current = null;
          undoStackRef.current = [];
          onBlur?.(event);
        }}
        onChange={(event) => {
          if (applyingProgrammaticChangeRef.current) {
            applyingProgrammaticChangeRef.current = false;
            onChange?.(event);
            return;
          }
          if (enableSelectNextOccurrence) {
            handleLinkedSelectionChange(
              event.currentTarget,
              linkedSelectionRef,
              pendingSelectionRef,
              undoStackRef,
            );
            setLinkedSelectionState(linkedSelectionRef.current);
          }
          onChange?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && enableSelectNextOccurrence) {
            if (
              handleUndoLinkedSelection(
                event,
                linkedSelectionRef,
                pendingSelectionRef,
                undoStackRef,
                applyingProgrammaticChangeRef,
              )
            ) {
              setLinkedSelectionState(linkedSelectionRef.current);
              return;
            }

            handleSelectNextOccurrence(event, linkedSelectionRef, pendingSelectionRef);
            setLinkedSelectionState(linkedSelectionRef.current);
          }
        }}
        onSelect={(event) => {
          onSelect?.(event);
          if (enableSelectNextOccurrence) {
            syncLinkedSelection(event.currentTarget, linkedSelectionRef);
            setLinkedSelectionState(linkedSelectionRef.current);
          }
        }}
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
          setScrollLeft(event.currentTarget.scrollLeft);
          onScroll?.(event);
        }}
        {...props}
      />
    </div>
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-[7px] border border-(--color-field-border) bg-(--color-field-bg) px-3 py-2 text-[13px] text-(--color-text-strong) transition-colors outline-none focus:border-(--color-field-focus)",
        className,
      )}
      {...props}
    />
  );
}

export function Pill({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: "neutral" | "accent" }>) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[7px] border px-2 py-1 text-[10px] font-medium tracking-[0.14em] uppercase",
        tone === "accent"
          ? "border-(--color-pill-accent-border) bg-(--color-pill-accent-bg) text-(--color-pill-accent-text)"
          : "border-(--color-pill-neutral-border) bg-(--color-pill-neutral-bg) text-(--color-pill-neutral-text)",
      )}
    >
      {children}
    </span>
  );
}

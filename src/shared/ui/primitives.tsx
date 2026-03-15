import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useDeferredValue,
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
  showWhitespace = false,
  textClassName,
  value,
  placeholder,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  showWhitespace?: boolean;
  textClassName?: string;
}) {
  const displayValue = toDisplayText(value);
  const deferredDisplayValue = useDeferredValue(displayValue);
  const overlayText = deferredDisplayValue || (typeof placeholder === "string" ? placeholder : "");

  return (
    <div className="relative">
      {showWhitespace ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-[7px] px-3 text-[13px] text-(--color-text-overlay)",
            textClassName,
          )}
        >
          <div className="truncate">{visualizeWhitespace(overlayText) || " "}</div>
        </div>
      ) : null}
      <input
        className={cn(
          "w-full rounded-[7px] border border-(--color-field-border) bg-(--color-field-bg) px-3 py-2 text-[13px] text-(--color-text-strong) transition-colors outline-none placeholder:text-(--color-text-placeholder) focus:border-(--color-field-focus)",
          textClassName,
          showWhitespace && "text-transparent caret-(--color-text-strong)",
          className,
        )}
        placeholder={showWhitespace ? "" : placeholder}
        value={value}
        {...props}
      />
    </div>
  );
}

export function Textarea({
  className,
  showWhitespace = false,
  textClassName,
  value,
  placeholder,
  onScroll,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  showWhitespace?: boolean;
  textClassName?: string;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const resolvedTextClassName = textClassName ?? "mail-editor-text";
  const displayValue = toDisplayText(value);
  const deferredDisplayValue = useDeferredValue(displayValue);
  const overlayText = deferredDisplayValue || (typeof placeholder === "string" ? placeholder : "");

  return (
    <div className="relative">
      {showWhitespace ? (
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
            {visualizeWhitespace(overlayText) || " "}
          </pre>
        </div>
      ) : null}
      <textarea
        className={cn(
          "min-h-28 w-full rounded-[7px] border border-(--color-field-border) bg-(--color-field-bg) px-3 py-2 text-(--color-text-strong) transition-colors outline-none placeholder:text-(--color-text-placeholder) focus:border-(--color-field-focus)",
          resolvedTextClassName,
          showWhitespace && "text-transparent caret-(--color-text-strong)",
          className,
        )}
        placeholder={showWhitespace ? "" : placeholder}
        value={value}
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

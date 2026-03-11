import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
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

export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-[10px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg)] text-[var(--color-text)]",
        className,
      )}
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
      ? "border border-[var(--color-button-primary-border)] bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] hover:border-[var(--color-button-primary-border-hover)] hover:bg-[var(--color-button-primary-bg-hover)]"
      : variant === "danger"
        ? "border border-[var(--color-button-danger-border)] bg-[var(--color-button-danger-bg)] text-[var(--color-button-danger-text)] hover:border-[var(--color-button-danger-border-hover)] hover:bg-[var(--color-button-danger-bg-hover)]"
        : variant === "ghost"
          ? "border border-transparent bg-transparent text-[var(--color-button-ghost-text)] hover:border-[var(--color-button-ghost-border-hover)] hover:bg-[var(--color-button-ghost-bg-hover)] hover:text-[var(--color-button-ghost-text-hover)]"
          : "border border-[var(--color-button-secondary-border)] bg-[var(--color-button-secondary-bg)] text-[var(--color-button-secondary-text)] hover:border-[var(--color-button-secondary-border-hover)] hover:bg-[var(--color-button-secondary-bg-hover)]";

  const sizeClassName =
    size === "sm" ? "rounded-md px-2.5 py-1.5 text-[12px]" : "rounded-md px-3 py-2 text-sm";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
    <label className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
          {label}
        </div>
        {hint ? <div className="text-xs text-[var(--color-text-hint)]">{hint}</div> : null}
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
  const overlayText = displayValue || (typeof placeholder === "string" ? placeholder : "");

  return (
    <div className="relative">
      {showWhitespace ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-md px-3 text-sm text-[var(--color-text-overlay)]",
            textClassName,
          )}
        >
          <div className="truncate">{visualizeWhitespace(overlayText) || " "}</div>
        </div>
      ) : null}
      <input
        className={cn(
          "w-full rounded-md border border-[var(--color-field-border)] bg-[var(--color-field-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition-colors placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-field-focus)]",
          textClassName,
          showWhitespace && "text-transparent caret-[var(--color-text-strong)]",
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
  const displayValue = toDisplayText(value);
  const overlayText = displayValue || (typeof placeholder === "string" ? placeholder : "");

  return (
    <div className="relative">
      {showWhitespace ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-md px-3 py-2.5 text-sm leading-7 text-[var(--color-text-overlay)]",
            textClassName,
          )}
        >
          <pre
            className="min-h-full whitespace-pre-wrap break-words"
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
          "min-h-32 w-full rounded-md border border-[var(--color-field-border)] bg-[var(--color-field-bg)] px-3 py-2.5 text-sm leading-7 text-[var(--color-text-strong)] outline-none transition-colors placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-field-focus)]",
          textClassName,
          showWhitespace && "text-transparent caret-[var(--color-text-strong)]",
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
        "w-full rounded-md border border-[var(--color-field-border)] bg-[var(--color-field-bg)] px-3 py-2.5 text-sm text-[var(--color-text-strong)] outline-none transition-colors focus:border-[var(--color-field-focus)]",
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
        "inline-flex rounded-md border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        tone === "accent"
          ? "border-[var(--color-pill-accent-border)] bg-[var(--color-pill-accent-bg)] text-[var(--color-pill-accent-text)]"
          : "border-[var(--color-pill-neutral-border)] bg-[var(--color-pill-neutral-bg)] text-[var(--color-pill-neutral-text)]",
      )}
    >
      {children}
    </span>
  );
}

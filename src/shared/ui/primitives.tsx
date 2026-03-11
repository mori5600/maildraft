import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
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
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-[10px] border border-[#1f232b] bg-[#141820] text-[#d5d9e0]",
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
      ? "border border-[#2f4b8b] bg-[#17233f] text-[#c6d7ff] hover:border-[#3a5aa8] hover:bg-[#1b2a4a]"
      : variant === "danger"
        ? "border border-[#4c2a31] bg-[#1e1417] text-[#ebb2bd] hover:border-[#623740] hover:bg-[#24171b]"
        : variant === "ghost"
          ? "border border-transparent bg-transparent text-[#8c95a5] hover:border-[#232831] hover:bg-[#161b22] hover:text-[#d5d9e0]"
          : "border border-[#272d37] bg-[#181d24] text-[#d5d9e0] hover:border-[#323945] hover:bg-[#1d232c]";

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
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#747d8d]">
          {label}
        </div>
        {hint ? <div className="text-xs text-[#596171]">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

export function Input({
  className,
  showWhitespace = false,
  value,
  placeholder,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { showWhitespace?: boolean }) {
  const displayValue = toDisplayText(value);
  const overlayText = displayValue || (typeof placeholder === "string" ? placeholder : "");

  return (
    <div className="relative">
      {showWhitespace ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-md px-3 text-sm text-[#77829a]"
        >
          <div className="truncate">{visualizeWhitespace(overlayText) || " "}</div>
        </div>
      ) : null}
      <input
        className={cn(
          "w-full rounded-md border border-[#272d37] bg-[#0f1319] px-3 py-2.5 text-sm text-[#e5e9f0] outline-none transition-colors placeholder:text-[#586171] focus:border-[#3e5fae]",
          showWhitespace && "text-transparent caret-[#e5e9f0]",
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
  value,
  placeholder,
  onScroll,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { showWhitespace?: boolean }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const displayValue = toDisplayText(value);
  const overlayText = displayValue || (typeof placeholder === "string" ? placeholder : "");

  return (
    <div className="relative">
      {showWhitespace ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-md px-3 py-2.5 text-sm leading-7 text-[#77829a]"
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
          "min-h-32 w-full rounded-md border border-[#272d37] bg-[#0f1319] px-3 py-2.5 text-sm leading-7 text-[#e5e9f0] outline-none transition-colors placeholder:text-[#586171] focus:border-[#3e5fae]",
          showWhitespace && "text-transparent caret-[#e5e9f0]",
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

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-[#272d37] bg-[#0f1319] px-3 py-2.5 text-sm text-[#e5e9f0] outline-none transition-colors focus:border-[#3e5fae]",
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
          ? "border-[#2f4b8b] bg-[#17233f] text-[#9db9ff]"
          : "border-[#232831] bg-[#161b22] text-[#7a8291]",
      )}
    >
      {children}
    </span>
  );
}

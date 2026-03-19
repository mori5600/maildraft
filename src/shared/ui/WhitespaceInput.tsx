import { type InputHTMLAttributes, useDeferredValue, useState } from "react";

import { visualizeWhitespace } from "../lib/whitespace";
import { Input } from "./primitives";

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

/** Renders a controlled single-line input that can visualize whitespace without mutating its value. */
export interface WhitespaceInputProps extends InputHTMLAttributes<HTMLInputElement> {
  showWhitespace?: boolean;
}

/** Layers whitespace markers over a native input while preserving normal editing and copy behavior. */
export function WhitespaceInput({
  className,
  onScroll,
  placeholder,
  showWhitespace = false,
  value,
  ...props
}: WhitespaceInputProps) {
  const displayValue = toDisplayText(value);
  const deferredDisplayValue = useDeferredValue(displayValue);
  const overlayText = deferredDisplayValue || (typeof placeholder === "string" ? placeholder : "");
  const [scrollLeft, setScrollLeft] = useState(0);

  return (
    <div className="relative">
      {showWhitespace ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-[7px] px-3 text-[13px] text-(--color-text-overlay)"
        >
          <div
            className="min-w-full whitespace-pre"
            style={{
              transform: `translateX(${-scrollLeft}px)`,
            }}
          >
            {visualizeWhitespace(overlayText) || " "}
          </div>
        </div>
      ) : null}

      <Input
        className={cn(showWhitespace && "text-transparent caret-(--color-text-strong)", className)}
        placeholder={showWhitespace ? "" : placeholder}
        value={value}
        onScroll={(event) => {
          setScrollLeft(event.currentTarget.scrollLeft);
          onScroll?.(event);
        }}
        {...props}
      />
    </div>
  );
}

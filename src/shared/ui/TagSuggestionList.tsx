import type { TagSuggestionOption } from "./tag-picker-options";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

interface TagSuggestionListProps {
  highlightedIndex: number;
  listboxId: string;
  onHighlight: (index: number) => void;
  onSelect: (tag: string) => void;
  options: TagSuggestionOption[];
}

export function TagSuggestionList({
  highlightedIndex,
  listboxId,
  onHighlight,
  onSelect,
  options,
}: TagSuggestionListProps) {
  return (
    <div
      className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-panel-bg) py-1 shadow-[0_8px_28px_rgba(8,12,18,0.18)]"
      id={listboxId}
      role="listbox"
    >
      {options.map((option, index) => (
        <button
          key={`${option.kind}:${option.value}`}
          aria-selected={index === highlightedIndex}
          className={cn(
            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-(--color-text) transition-colors",
            index === highlightedIndex
              ? "bg-(--color-list-active-bg) text-(--color-text-strong)"
              : "hover:bg-(--color-list-hover-bg)",
          )}
          id={`${listboxId}-${index}`}
          role="option"
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onSelect(option.value)}
        >
          <span className="truncate">{option.label}</span>
          <span className="text-[10px] tracking-[0.08em] text-(--color-text-subtle) uppercase">
            {option.kind === "existing" ? "既存" : "新規"}
          </span>
        </button>
      ))}
    </div>
  );
}

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

interface TagFilterBarProps {
  activeTag: string | null;
  availableTags: string[];
  onChangeTag: (tag: string | null) => void;
}

function filterButtonClassName(isActive: boolean): string {
  return cn(
    "mail-button-focus inline-flex items-center rounded-[7px] border px-2 py-1 text-[10px] leading-5 transition-colors",
    isActive
      ? "border-(--color-pill-accent-border) bg-(--color-pill-accent-bg) text-(--color-pill-accent-text)"
      : "border-(--color-pill-neutral-border) bg-(--color-pill-neutral-bg) text-(--color-pill-neutral-text)",
  );
}

export function TagFilterBar({ activeTag, availableTags, onChangeTag }: TagFilterBarProps) {
  if (availableTags.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-1.5">
      <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">タグ</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          aria-pressed={activeTag === null}
          className={filterButtonClassName(activeTag === null)}
          type="button"
          onClick={() => onChangeTag(null)}
        >
          すべて
        </button>
        {availableTags.map((tag) => (
          <button
            key={tag}
            aria-pressed={activeTag === tag}
            className={filterButtonClassName(activeTag === tag)}
            type="button"
            onClick={() => onChangeTag(activeTag === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

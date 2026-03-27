function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

interface TagBadgeListProps {
  className?: string;
  maxVisible?: number;
  tags: string[];
}

export function TagBadgeList({ className, maxVisible = 3, tags }: TagBadgeListProps) {
  if (tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-[7px] border border-(--color-pill-neutral-border) bg-(--color-pill-neutral-bg) px-2 py-0.5 text-[10px] leading-5 text-(--color-pill-neutral-text)"
        >
          {tag}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="inline-flex items-center rounded-[7px] border border-(--color-pill-neutral-border) bg-(--color-pill-neutral-bg) px-2 py-0.5 text-[10px] leading-5 text-(--color-pill-neutral-text)">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

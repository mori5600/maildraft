interface TagChipListProps {
  onRemoveTag: (tag: string) => void;
  tags: string[];
}

export function TagChipList({ onRemoveTag, tags }: TagChipListProps) {
  return tags.map((tag) => (
    <button
      key={tag}
      aria-label={`タグ「${tag}」を削除`}
      className="mail-button-focus inline-flex items-center gap-1 rounded-[999px] border border-(--color-pill-neutral-border) bg-(--color-panel-bg) px-2.5 py-1 text-[11px] text-(--color-text-muted)"
      type="button"
      onClick={() => onRemoveTag(tag)}
    >
      <span>{tag}</span>
      <span aria-hidden="true" className="text-[10px] text-(--color-text-overlay)">
        ×
      </span>
    </button>
  ));
}

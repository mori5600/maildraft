import { useEffect, useMemo, useRef, useState } from "react";

import { truncate } from "../../../shared/lib/text";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Input, Pill } from "../../../shared/ui/primitives";
import { TagBadgeList } from "../../../shared/ui/TagBadgeList";
import {
  type ContentBlock,
  contentBlockCategoryLabel,
  contentBlockLabel,
} from "../../blocks/model";
import { selectInsertableBlocks } from "../../blocks/state/block-selectors";
import { type DraftBlockInsertTarget, draftBlockInsertTargetLabel } from "../model";

interface DraftBlockInsertOverlayProps {
  blocks: ContentBlock[];
  target: DraftBlockInsertTarget | null;
  onClose: () => void;
  onInsertBlock: (target: DraftBlockInsertTarget, blockId: string) => void;
}

export function DraftBlockInsertOverlay({
  blocks,
  target,
  onClose,
  onInsertBlock,
}: DraftBlockInsertOverlayProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const insertableBlocks = useMemo(
    () => selectInsertableBlocks(blocks, searchQuery),
    [blocks, searchQuery],
  );
  const targetLabel = target ? draftBlockInsertTargetLabel(target) : "";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  function handleInsert(blockId: string) {
    if (!target) {
      return;
    }

    onInsertBlock(target, blockId);
    onClose();
  }

  return (
    <PreviewOverlay
      description={target ? `${targetLabel}に追加します。` : undefined}
      isOpen
      title="文面ブロックを挿入"
      onClose={onClose}
    >
      <div className="grid gap-3">
        <Input
          ref={searchInputRef}
          aria-label="文面ブロックを検索"
          placeholder="ブロック名・本文・タグで検索"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
        />

        {insertableBlocks.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            {blocks.some((block) => block.body.trim().length > 0)
              ? "条件に一致する文面ブロックはありません。"
              : "本文のある文面ブロックはまだありません。"}
          </div>
        ) : (
          <div className="space-y-1">
            {insertableBlocks.map((block) => (
              <button
                key={block.id}
                className="mail-list-item w-full rounded-[7px] border border-transparent px-3 py-2 text-left transition-colors hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                type="button"
                onClick={() => handleInsert(block.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                    {contentBlockLabel(block)}
                  </div>
                  <Pill tone="neutral">{contentBlockCategoryLabel(block.category)}</Pill>
                </div>
                <div className="mt-1 text-xs leading-6 text-(--color-text)">
                  {truncate(block.body, 120)}
                </div>
                <TagBadgeList className="mt-1.5" tags={block.tags} />
              </button>
            ))}
          </div>
        )}
      </div>
    </PreviewOverlay>
  );
}

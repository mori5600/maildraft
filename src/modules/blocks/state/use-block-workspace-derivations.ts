import { useMemo } from "react";

import {
  collectTagCounts,
  collectUniqueTags,
  resolveActiveTagFilter,
} from "../../../shared/lib/tags";
import type { StoreSnapshot } from "../../../shared/types/store";
import type { ContentBlockInput } from "../model";
import { filterBlocks } from "./block-selectors";

interface UseBlockWorkspaceDerivationsOptions {
  blockForm: ContentBlockInput;
  deferredBlockSearchQuery: string;
  requestedTagFilter: string | null;
  snapshot: StoreSnapshot;
}

export function useBlockWorkspaceDerivations({
  blockForm,
  deferredBlockSearchQuery,
  requestedTagFilter,
  snapshot,
}: UseBlockWorkspaceDerivationsOptions) {
  const availableBlockTagCounts = useMemo(
    () => collectTagCounts(snapshot.blocks),
    [snapshot.blocks],
  );
  const availableBlockTags = useMemo(() => collectUniqueTags(snapshot.blocks), [snapshot.blocks]);
  const activeBlockTagFilter = useMemo(
    () => resolveActiveTagFilter(availableBlockTags, requestedTagFilter),
    [availableBlockTags, requestedTagFilter],
  );
  const filteredBlocks = useMemo(
    () => filterBlocks(snapshot.blocks, deferredBlockSearchQuery, activeBlockTagFilter),
    [activeBlockTagFilter, deferredBlockSearchQuery, snapshot.blocks],
  );
  const selectedBlockUpdatedAt = useMemo(
    () => snapshot.blocks.find((block) => block.id === blockForm.id)?.updatedAt ?? null,
    [blockForm.id, snapshot.blocks],
  );

  return {
    activeBlockTagFilter,
    availableBlockTagCounts,
    availableBlockTags,
    filteredBlocks,
    selectedBlockUpdatedAt,
  };
}

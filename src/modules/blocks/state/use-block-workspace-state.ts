import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  applyDeletedBlockResult,
  applySavedBlockResult,
  pickBlockInput,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { buildTrashItemKey } from "../../trash/model";
import {
  type ContentBlockInput,
  createEmptyContentBlock,
  duplicateContentBlockInput,
} from "../model";
import {
  buildBlockEditingState,
  createInitialBlockState,
  toBlockWorkspaceErrorMessage,
} from "./block-workspace-helpers";
import { useBlockAutoSave } from "./use-block-auto-save";
import { useBlockWorkspaceDerivations } from "./use-block-workspace-derivations";

export interface BlockWorkspaceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  onTrashItemSelect: (key: string | null) => void;
  onViewChange: (view: WorkspaceView) => void;
  snapshot: StoreSnapshot;
}

export function useBlockWorkspaceState({
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
  onTrashItemSelect,
  onViewChange,
  snapshot,
}: BlockWorkspaceStateOptions) {
  const [initialBlockState] = useState(() => createInitialBlockState(snapshot));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialBlockState.selectedBlockId,
  );
  const [blockForm, setBlockForm] = useState<ContentBlockInput>(initialBlockState.blockForm);
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [blockTagFilterState, setBlockTagFilter] = useState<string | null>(null);
  const deferredBlockSearchQuery = useDeferredValue(blockSearchQuery);
  const blockFormRef = useRef(blockForm);
  const selectedBlockIdRef = useRef(selectedBlockId);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    blockFormRef.current = blockForm;
  }, [blockForm]);

  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId;
  }, [selectedBlockId]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const {
    activeBlockTagFilter,
    availableBlockTagCounts,
    availableBlockTags,
    filteredBlocks,
    selectedBlockUpdatedAt,
  } = useBlockWorkspaceDerivations({
    blockForm,
    deferredBlockSearchQuery,
    requestedTagFilter: blockTagFilterState,
    snapshot,
  });

  const { autoSaveLabel, flushPendingBlock, saveBlock } = useBlockAutoSave({
    blockForm,
    blockFormRef,
    initialAutoSaveState: initialBlockState.autoSaveState,
    onClearError,
    onError,
    onNotice,
    onSnapshotChange,
    selectedBlockId,
    setBlockForm,
    setSelectedBlockId,
    snapshot,
    snapshotRef,
  });

  const hydrateBlockState = useCallback(
    (nextSnapshot: StoreSnapshot, preferredBlockId: string | null = null) => {
      const nextState = buildBlockEditingState(nextSnapshot, preferredBlockId);
      setSelectedBlockId(nextState.selectedBlockId);
      setBlockForm(nextState.blockForm);
    },
    [],
  );

  const selectBlock = useCallback(
    (blockId: string) => {
      if (selectedBlockIdRef.current !== blockId) {
        flushPendingBlock();
      }

      const nextBlock = snapshotRef.current.blocks.find((block) => block.id === blockId);
      if (!nextBlock) {
        return;
      }

      setSelectedBlockId(blockId);
      setBlockForm(pickBlockInput(snapshotRef.current, blockId));
      onViewChange("blocks");
    },
    [flushPendingBlock, onViewChange],
  );

  const createBlock = useCallback(() => {
    flushPendingBlock();
    setSelectedBlockId(null);
    setBlockForm(createEmptyContentBlock());
    onViewChange("blocks");
    onNotice("新しい文面ブロックを作成しています。");
  }, [flushPendingBlock, onNotice, onViewChange]);

  function changeBlock<K extends keyof ContentBlockInput>(field: K, value: ContentBlockInput[K]) {
    setBlockForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function duplicateBlock() {
    if (!selectedBlockId) {
      return;
    }

    try {
      onClearError();
      const savedBlock = await maildraftApi.saveBlock(duplicateContentBlockInput(blockForm));
      const nextSnapshot = applySavedBlockResult(snapshotRef.current, savedBlock);
      onSnapshotChange(nextSnapshot);
      hydrateBlockState(nextSnapshot, savedBlock.block.id);
      onNotice("文面ブロックを複製しました。");
    } catch (duplicateError) {
      onError(toBlockWorkspaceErrorMessage(duplicateError));
    }
  }

  async function deleteBlock() {
    if (!selectedBlockId) {
      setBlockForm(createEmptyContentBlock());
      onNotice("編集中の文面ブロックをリセットしました。");
      return;
    }

    try {
      onClearError();
      const deletedBlock = await maildraftApi.deleteBlock(selectedBlockId);
      const nextSnapshot = applyDeletedBlockResult(snapshotRef.current, deletedBlock);
      onSnapshotChange(nextSnapshot);
      hydrateBlockState(nextSnapshot);
      onTrashItemSelect(buildTrashItemKey("block", selectedBlockId));
      onNotice("文面ブロックをゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toBlockWorkspaceErrorMessage(deleteError));
    }
  }

  return {
    createBlock,
    flushPendingBlock,
    hydrateBlockState,
    saveBlock,
    blockWorkspaceProps: {
      activeTagFilter: activeBlockTagFilter,
      autoSaveLabel,
      availableTags: availableBlockTags,
      tagCounts: availableBlockTagCounts,
      blockForm,
      blocks: filteredBlocks,
      onChangeBlock: changeBlock,
      onChangeSearchQuery: setBlockSearchQuery,
      onChangeTagFilter: setBlockTagFilter,
      onCreateBlock: createBlock,
      onDeleteBlock: deleteBlock,
      onDuplicateBlock: duplicateBlock,
      onSaveBlock: saveBlock,
      onSelectBlock: selectBlock,
      searchQuery: blockSearchQuery,
      selectedBlockId,
      selectedBlockUpdatedAt,
      showWhitespace: false,
      totalBlockCount: snapshot.blocks.length,
    },
  };
}

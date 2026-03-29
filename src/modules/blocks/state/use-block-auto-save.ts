import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { applySavedBlockResult, pickBlockInput } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  contentBlockHasMeaningfulContent,
  type ContentBlockInput,
  contentBlockMatchesPersistedBlock,
} from "../model";
import {
  type BlockAutoSaveState,
  formatBlockAutoSaveState,
  shouldAutoPersistBlock,
  toBlockWorkspaceErrorMessage,
} from "./block-workspace-helpers";

const AUTO_SAVE_DELAY_MS = 900;

interface TransientBlockAutoSaveState {
  kind: "error" | "saving";
  blockRevision: string;
}

interface BlockAutoSaveOptions {
  blockForm: ContentBlockInput;
  blockFormRef: RefObject<ContentBlockInput>;
  initialAutoSaveState: BlockAutoSaveState;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  selectedBlockId: string | null;
  setBlockForm: Dispatch<SetStateAction<ContentBlockInput>>;
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  snapshot: StoreSnapshot;
  snapshotRef: RefObject<StoreSnapshot>;
}

export function useBlockAutoSave({
  blockForm,
  blockFormRef,
  initialAutoSaveState,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
  selectedBlockId,
  setBlockForm,
  setSelectedBlockId,
  snapshot,
  snapshotRef,
}: BlockAutoSaveOptions) {
  const [transientBlockAutoSaveState, setTransientBlockAutoSaveState] =
    useState<TransientBlockAutoSaveState | null>(() =>
      initialAutoSaveState === "error" || initialAutoSaveState === "saving"
        ? {
            kind: initialAutoSaveState,
            blockRevision: serializeBlockRevision(blockForm),
          }
        : null,
    );

  const persistBlock = useCallback(
    async ({ input, mode }: { input: ContentBlockInput; mode: "manual" | "auto" }) => {
      const affectsCurrentBlock = blockFormRef.current.id === input.id;

      if (mode === "auto" && !shouldAutoPersistBlock(input, snapshotRef.current)) {
        return;
      }

      try {
        if (mode === "auto" && affectsCurrentBlock) {
          setTransientBlockAutoSaveState({
            kind: "saving",
            blockRevision: serializeBlockRevision(input),
          });
        }

        if (mode === "manual") {
          onClearError();
        }

        const savedBlock = await maildraftApi.saveBlock(input);
        const nextSnapshot = applySavedBlockResult(snapshotRef.current, savedBlock);
        onSnapshotChange(nextSnapshot);

        if (blockFormRef.current.id === input.id) {
          setSelectedBlockId(savedBlock.block.id);
          setBlockForm(pickBlockInput(nextSnapshot, savedBlock.block.id));
        }

        if (mode === "manual") {
          setTransientBlockAutoSaveState(null);
          onNotice("文面ブロックを保存しました。");
        } else if (affectsCurrentBlock) {
          setTransientBlockAutoSaveState(null);
        }
      } catch (saveError) {
        if (affectsCurrentBlock) {
          setTransientBlockAutoSaveState({
            kind: "error",
            blockRevision: serializeBlockRevision(input),
          });
        }

        onError(toBlockWorkspaceErrorMessage(saveError));
      }
    },
    [
      blockFormRef,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      setBlockForm,
      setSelectedBlockId,
      snapshotRef,
    ],
  );

  const persistedBlockIndex = useMemo(
    () => new Map(snapshot.blocks.map((block) => [block.id, block] as const)),
    [snapshot.blocks],
  );
  const persistedBlock = persistedBlockIndex.get(blockForm.id) ?? null;
  const blockShouldPersist =
    selectedBlockId !== null || contentBlockHasMeaningfulContent(blockForm);
  const blockIsDirty =
    blockShouldPersist && !contentBlockMatchesPersistedBlock(blockForm, persistedBlock);
  const blockRevision = useMemo(() => serializeBlockRevision(blockForm), [blockForm]);
  const baseBlockAutoSaveState: BlockAutoSaveState = !blockShouldPersist
    ? "idle"
    : blockIsDirty
      ? "dirty"
      : "saved";
  const blockAutoSaveState =
    transientBlockAutoSaveState?.blockRevision === blockRevision
      ? transientBlockAutoSaveState.kind
      : baseBlockAutoSaveState;

  useEffect(() => {
    if (!blockShouldPersist || !blockIsDirty) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistBlock({
        input: blockForm,
        mode: "auto",
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [blockForm, blockIsDirty, blockShouldPersist, persistBlock]);

  const flushPendingBlock = useCallback(() => {
    if (!shouldAutoPersistBlock(blockFormRef.current, snapshotRef.current)) {
      return;
    }

    void persistBlock({
      input: blockFormRef.current,
      mode: "auto",
    });
  }, [blockFormRef, persistBlock, snapshotRef]);

  const saveBlock = useCallback(async () => {
    await persistBlock({
      input: blockForm,
      mode: "manual",
    });
  }, [blockForm, persistBlock]);

  return {
    autoSaveLabel: formatBlockAutoSaveState(blockAutoSaveState),
    flushPendingBlock,
    saveBlock,
  };
}

function serializeBlockRevision(input: ContentBlockInput): string {
  return JSON.stringify({
    body: input.body,
    category: input.category,
    id: input.id,
    name: input.name,
    tags: input.tags,
  });
}

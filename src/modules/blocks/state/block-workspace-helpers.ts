import type { StoreSnapshot } from "../../../shared/types/store";
import {
  type ContentBlock,
  contentBlockHasMeaningfulContent,
  type ContentBlockInput,
  contentBlockMatchesPersistedBlock,
  createEmptyContentBlock,
  toContentBlockInput,
} from "../model";

export type BlockAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface BlockSelectionState {
  selectedBlockId: string | null;
  blockForm: ContentBlockInput;
}

export interface InitialBlockState extends BlockSelectionState {
  autoSaveState: BlockAutoSaveState;
}

export function findContentBlock(
  snapshot: StoreSnapshot,
  blockId: string | null,
): ContentBlock | null {
  if (!blockId) {
    return null;
  }

  return snapshot.blocks.find((block) => block.id === blockId) ?? null;
}

export function buildBlockEditingState(
  snapshot: StoreSnapshot,
  preferredBlockId: string | null = null,
): BlockSelectionState {
  const selectedBlock = findContentBlock(snapshot, preferredBlockId) ?? snapshot.blocks[0] ?? null;

  return {
    selectedBlockId: selectedBlock?.id ?? null,
    blockForm: selectedBlock ? toContentBlockInput(selectedBlock) : createEmptyContentBlock(),
  };
}

export function createInitialBlockState(snapshot: StoreSnapshot): InitialBlockState {
  const nextState = buildBlockEditingState(snapshot);

  return {
    ...nextState,
    autoSaveState: nextState.selectedBlockId ? "saved" : "idle",
  };
}

export function formatBlockAutoSaveState(state: BlockAutoSaveState): string {
  switch (state) {
    case "idle":
      return "自動保存待機中";
    case "dirty":
      return "未保存の変更があります";
    case "saving":
      return "自動保存しています";
    case "saved":
      return "自動保存済み";
    case "error":
      return "自動保存に失敗しました";
  }
}

export function shouldAutoPersistBlock(input: ContentBlockInput, snapshot: StoreSnapshot): boolean {
  const persistedBlock = snapshot.blocks.find((block) => block.id === input.id) ?? null;

  if (!persistedBlock && !contentBlockHasMeaningfulContent(input)) {
    return false;
  }

  return !contentBlockMatchesPersistedBlock(input, persistedBlock);
}

export function toBlockWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

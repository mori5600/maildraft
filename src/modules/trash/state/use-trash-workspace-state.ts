import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  applyRestoredDraftResult,
  applyRestoredMemoResult,
  applyRestoredSignatureResult,
  applyRestoredTemplateResult,
  applyTrashMutationResult,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import { collectTrashItems, type TrashedSignature, type TrashItem } from "../model";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

interface TrashWorkspaceStateOptions {
  onClearError: () => void;
  onDraftRestored: (draftId: string, snapshot: StoreSnapshot) => void;
  onError: (message: string) => void;
  onMemoRestored?: (snapshot: StoreSnapshot, memoId: string) => void;
  onNotice: (message: string) => void;
  onSignatureRestored: (snapshot: StoreSnapshot, signatureId: string) => void;
  onSignatureSnapshotChange: (snapshot: StoreSnapshot) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  onTemplateRestored: (snapshot: StoreSnapshot, templateId: string) => void;
  onTrashSelectionChange: (key: string | null) => void;
  onViewChange: (view: WorkspaceView) => void;
  selectedTrashItemKey: string | null;
  snapshot: StoreSnapshot;
}

type TrashItemStrategyMap<Result> = {
  [Kind in TrashItem["kind"]]: (item: Extract<TrashItem, { kind: Kind }>) => Result;
};

type RestoreTrashItemContext = Required<Pick<TrashWorkspaceStateOptions, "onMemoRestored">> &
  Pick<
    TrashWorkspaceStateOptions,
    | "onDraftRestored"
    | "onNotice"
    | "onSignatureRestored"
    | "onSnapshotChange"
    | "onTemplateRestored"
    | "onViewChange"
  > & {
    snapshot: StoreSnapshot;
  };

type DeleteTrashItemContext = Pick<
  TrashWorkspaceStateOptions,
  "onNotice" | "onSignatureSnapshotChange" | "onSnapshotChange"
> & {
  snapshot: StoreSnapshot;
};

function runTrashItemStrategy<Result>(
  strategies: TrashItemStrategyMap<Result>,
  item: TrashItem,
): Result {
  return (strategies[item.kind]! as (selectedItem: TrashItem) => Result)(item);
}

function createRestoreTrashItemStrategies(
  context: RestoreTrashItemContext,
): TrashItemStrategyMap<Promise<void>> {
  return {
    draft: async (item) => {
      const restoredDraft = await maildraftApi.restoreDraftFromTrash(item.draft.id);
      const nextSnapshot = applyRestoredDraftResult(context.snapshot, restoredDraft);
      context.onSnapshotChange(nextSnapshot);
      context.onDraftRestored(item.draft.id, nextSnapshot);
      context.onViewChange("drafts");
      context.onNotice("下書きをゴミ箱から復元しました。");
    },
    template: async (item) => {
      const restoredTemplate = await maildraftApi.restoreTemplateFromTrash(item.template.id);
      const nextSnapshot = applyRestoredTemplateResult(context.snapshot, restoredTemplate);
      context.onSnapshotChange(nextSnapshot);
      context.onTemplateRestored(nextSnapshot, item.template.id);
      context.onViewChange("templates");
      context.onNotice("テンプレートをゴミ箱から復元しました。");
    },
    memo: async (item) => {
      const restoredMemo = await maildraftApi.restoreMemoFromTrash(item.memo.id);
      const nextSnapshot = applyRestoredMemoResult(context.snapshot, restoredMemo);
      context.onSnapshotChange(nextSnapshot);
      context.onMemoRestored(nextSnapshot, item.memo.id);
      context.onViewChange("memo");
      context.onNotice("メモをゴミ箱から復元しました。");
    },
    signature: async (item) => {
      const restoredSignature = await maildraftApi.restoreSignatureFromTrash(item.signature.id);
      const nextSnapshot = applyRestoredSignatureResult(
        context.snapshot,
        restoredSignature,
        item.signature.id,
      );
      context.onSnapshotChange(nextSnapshot);
      context.onSignatureRestored(nextSnapshot, item.signature.id);
      context.onViewChange("signatures");
      context.onNotice("署名をゴミ箱から復元しました。");
    },
  };
}

function createDeleteTrashItemStrategies(
  context: DeleteTrashItemContext,
): TrashItemStrategyMap<Promise<void>> {
  return {
    draft: async (item) => {
      const deletedDraft = await maildraftApi.permanentlyDeleteDraftFromTrash(item.draft.id);
      const nextSnapshot = applyTrashMutationResult(context.snapshot, deletedDraft);
      context.onSnapshotChange(nextSnapshot);
      context.onNotice("下書きを完全に削除しました。");
    },
    template: async (item) => {
      const deletedTemplate = await maildraftApi.permanentlyDeleteTemplateFromTrash(
        item.template.id,
      );
      const nextSnapshot = applyTrashMutationResult(context.snapshot, deletedTemplate);
      context.onSnapshotChange(nextSnapshot);
      context.onNotice("テンプレートを完全に削除しました。");
    },
    memo: async (item) => {
      const deletedMemo = await maildraftApi.permanentlyDeleteMemoFromTrash(item.memo.id);
      const nextSnapshot = applyTrashMutationResult(context.snapshot, deletedMemo);
      context.onSnapshotChange(nextSnapshot);
      context.onNotice("メモを完全に削除しました。");
    },
    signature: async (item) => {
      const deletedSignature = await maildraftApi.permanentlyDeleteSignatureFromTrash(
        item.signature.id,
      );
      const nextSnapshot = applyTrashMutationResult(context.snapshot, deletedSignature);
      context.onSnapshotChange(nextSnapshot);
      context.onSignatureSnapshotChange(nextSnapshot);
      context.onNotice("署名を完全に削除しました。");
    },
  };
}

/**
 * Coordinates trash selection and destructive trash actions against the current snapshot.
 *
 * @remarks
 * Selection falls back to the first remaining trash item whenever the current item disappears.
 * Restore routes the user back to the owning workspace. Permanent delete and empty trash patch
 * compact backend payloads into the current snapshot instead of forcing a full reload. Signature
 * mutations also notify external signature consumers because restoring or deleting a signature may
 * change active default-signature state.
 */
export function useTrashWorkspaceState({
  onClearError,
  onDraftRestored,
  onError,
  onMemoRestored = () => {},
  onNotice,
  onSignatureRestored,
  onSignatureSnapshotChange,
  onSnapshotChange,
  onTemplateRestored,
  onTrashSelectionChange,
  onViewChange,
  selectedTrashItemKey,
  snapshot,
}: TrashWorkspaceStateOptions) {
  const snapshotRef = useRef(snapshot);
  const trashItems = useMemo(() => collectTrashItems(snapshot.trash), [snapshot.trash]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (trashItems.length === 0) {
      if (selectedTrashItemKey !== null) {
        onTrashSelectionChange(null);
      }
      return;
    }

    if (selectedTrashItemKey && trashItems.some((item) => item.key === selectedTrashItemKey)) {
      return;
    }

    onTrashSelectionChange(trashItems[0].key);
  }, [onTrashSelectionChange, selectedTrashItemKey, trashItems]);

  function selectTrashItem(key: string) {
    onTrashSelectionChange(key);
    onViewChange("trash");
  }

  async function restoreTrashItem(item: TrashItem) {
    try {
      onClearError();
      await runTrashItemStrategy(
        createRestoreTrashItemStrategies({
          snapshot: snapshotRef.current,
          onDraftRestored,
          onMemoRestored,
          onNotice,
          onSignatureRestored,
          onSnapshotChange,
          onTemplateRestored,
          onViewChange,
        }),
        item,
      );
    } catch (restoreError) {
      onError(toErrorMessage(restoreError));
    }
  }

  async function permanentlyDeleteTrashItem(item: TrashItem) {
    const confirmed = await confirm("この項目を完全に削除します。元に戻せません。続けますか？", {
      title: "MailDraft",
      kind: "warning",
      okLabel: "完全削除",
      cancelLabel: "キャンセル",
    });

    if (!confirmed) {
      return;
    }

    try {
      onClearError();
      await runTrashItemStrategy(
        createDeleteTrashItemStrategies({
          snapshot: snapshotRef.current,
          onNotice,
          onSignatureSnapshotChange,
          onSnapshotChange,
        }),
        item,
      );
    } catch (deleteError) {
      onError(toErrorMessage(deleteError));
    }
  }

  async function emptyTrash() {
    const confirmed = await confirm("ゴミ箱を空にします。元に戻せません。続けますか？", {
      title: "MailDraft",
      kind: "warning",
      okLabel: "ゴミ箱を空にする",
      cancelLabel: "キャンセル",
    });

    if (!confirmed) {
      return;
    }

    try {
      onClearError();
      const emptiedTrash = await maildraftApi.emptyTrash();
      const nextSnapshot = applyTrashMutationResult(snapshotRef.current, emptiedTrash);
      onSnapshotChange(nextSnapshot);
      onTrashSelectionChange(null);
      onSignatureSnapshotChange(nextSnapshot);
      onNotice("ゴミ箱を空にしました。");
    } catch (emptyError) {
      onError(toErrorMessage(emptyError));
    }
  }

  return {
    trashItems,
    trashWorkspaceProps: {
      items: trashItems,
      onDeleteItemPermanently: permanentlyDeleteTrashItem,
      onEmptyTrash: emptyTrash,
      onRestoreItem: restoreTrashItem,
      onSelectItem: selectTrashItem,
      selectedItemKey: selectedTrashItemKey,
      signatures: snapshot.signatures,
      trashedSignatures: snapshot.trash.signatures as TrashedSignature[],
    },
  };
}

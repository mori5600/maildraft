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

      if (item.kind === "draft") {
        const restoredDraft = await maildraftApi.restoreDraftFromTrash(item.draft.id);
        const nextSnapshot = applyRestoredDraftResult(snapshotRef.current, restoredDraft);
        onSnapshotChange(nextSnapshot);
        onDraftRestored(item.draft.id, nextSnapshot);
        onViewChange("drafts");
        onNotice("下書きをゴミ箱から復元しました。");
        return;
      }

      if (item.kind === "template") {
        const restoredTemplate = await maildraftApi.restoreTemplateFromTrash(item.template.id);
        const nextSnapshot = applyRestoredTemplateResult(snapshotRef.current, restoredTemplate);
        onSnapshotChange(nextSnapshot);
        onTemplateRestored(nextSnapshot, item.template.id);
        onViewChange("templates");
        onNotice("テンプレートをゴミ箱から復元しました。");
        return;
      }

      if (item.kind === "memo") {
        const restoredMemo = await maildraftApi.restoreMemoFromTrash(item.memo.id);
        const nextSnapshot = applyRestoredMemoResult(snapshotRef.current, restoredMemo);
        onSnapshotChange(nextSnapshot);
        onMemoRestored(nextSnapshot, item.memo.id);
        onViewChange("memo");
        onNotice("メモをゴミ箱から復元しました。");
        return;
      }

      const restoredSignature = await maildraftApi.restoreSignatureFromTrash(item.signature.id);
      const nextSnapshot = applyRestoredSignatureResult(
        snapshotRef.current,
        restoredSignature,
        item.signature.id,
      );
      onSnapshotChange(nextSnapshot);
      onSignatureRestored(nextSnapshot, item.signature.id);
      onViewChange("signatures");
      onNotice("署名をゴミ箱から復元しました。");
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

      if (item.kind === "draft") {
        const deletedDraft = await maildraftApi.permanentlyDeleteDraftFromTrash(item.draft.id);
        const nextSnapshot = applyTrashMutationResult(snapshotRef.current, deletedDraft);
        onSnapshotChange(nextSnapshot);
        onNotice("下書きを完全に削除しました。");
        return;
      }

      if (item.kind === "template") {
        const deletedTemplate = await maildraftApi.permanentlyDeleteTemplateFromTrash(
          item.template.id,
        );
        const nextSnapshot = applyTrashMutationResult(snapshotRef.current, deletedTemplate);
        onSnapshotChange(nextSnapshot);
        onNotice("テンプレートを完全に削除しました。");
        return;
      }

      if (item.kind === "memo") {
        const deletedMemo = await maildraftApi.permanentlyDeleteMemoFromTrash(item.memo.id);
        const nextSnapshot = applyTrashMutationResult(snapshotRef.current, deletedMemo);
        onSnapshotChange(nextSnapshot);
        onNotice("メモを完全に削除しました。");
        return;
      }

      const deletedSignature = await maildraftApi.permanentlyDeleteSignatureFromTrash(
        item.signature.id,
      );
      const nextSnapshot = applyTrashMutationResult(snapshotRef.current, deletedSignature);
      onSnapshotChange(nextSnapshot);
      onSignatureSnapshotChange(nextSnapshot);
      onNotice("署名を完全に削除しました。");
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

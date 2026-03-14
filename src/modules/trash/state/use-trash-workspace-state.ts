import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import {
  collectTrashItems,
  type TrashedSignature,
  type TrashItem,
} from "../model";

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

export function useTrashWorkspaceState({
  onClearError,
  onDraftRestored,
  onError,
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
  const trashItems = useMemo(() => collectTrashItems(snapshot.trash), [snapshot.trash]);

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
        const nextSnapshot = await maildraftApi.restoreDraftFromTrash(item.draft.id);
        onSnapshotChange(nextSnapshot);
        onDraftRestored(item.draft.id, nextSnapshot);
        onViewChange("drafts");
        onNotice("下書きをゴミ箱から復元しました。");
        return;
      }

      if (item.kind === "template") {
        const nextSnapshot = await maildraftApi.restoreTemplateFromTrash(item.template.id);
        onSnapshotChange(nextSnapshot);
        onTemplateRestored(nextSnapshot, item.template.id);
        onViewChange("templates");
        onNotice("テンプレートをゴミ箱から復元しました。");
        return;
      }

      const nextSnapshot = await maildraftApi.restoreSignatureFromTrash(item.signature.id);
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
        const nextSnapshot = await maildraftApi.permanentlyDeleteDraftFromTrash(item.draft.id);
        onSnapshotChange(nextSnapshot);
        onNotice("下書きを完全に削除しました。");
        return;
      }

      if (item.kind === "template") {
        const nextSnapshot = await maildraftApi.permanentlyDeleteTemplateFromTrash(item.template.id);
        onSnapshotChange(nextSnapshot);
        onNotice("テンプレートを完全に削除しました。");
        return;
      }

      const nextSnapshot = await maildraftApi.permanentlyDeleteSignatureFromTrash(item.signature.id);
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
      const nextSnapshot = await maildraftApi.emptyTrash();
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

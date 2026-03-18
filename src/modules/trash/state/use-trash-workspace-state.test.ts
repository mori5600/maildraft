import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const confirmMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: confirmMock,
}));

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  createDraft,
  createDraftHistoryEntry,
  createSignature,
  createStoreSnapshot,
  createTemplate,
} from "../../../test/ui-fixtures";
import { buildTrashItemKey } from "../model";
import { useTrashWorkspaceState } from "./use-trash-workspace-state";

function createBaseCallbacks() {
  return {
    onClearError: vi.fn(),
    onDraftRestored: vi.fn(),
    onError: vi.fn(),
    onNotice: vi.fn(),
    onSignatureRestored: vi.fn(),
    onSignatureSnapshotChange: vi.fn(),
    onSnapshotChange: vi.fn(),
    onTemplateRestored: vi.fn(),
    onTrashSelectionChange: vi.fn(),
    onViewChange: vi.fn(),
  };
}

describe("trash workspace state", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("selects the first trash item when the current selection is missing", () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const callbacks = createBaseCallbacks();

    renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: "draft:missing",
        snapshot,
      }),
    );

    expect(callbacks.onTrashSelectionChange).toHaveBeenCalledWith("draft:draft-trash");
  });

  it("clears the trash selection when the trash becomes empty", () => {
    const callbacks = createBaseCallbacks();

    renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: "draft:draft-trash",
        snapshot: createStoreSnapshot({
          trash: {
            drafts: [],
            templates: [],
            signatures: [],
          },
        }),
      }),
    );

    expect(callbacks.onTrashSelectionChange).toHaveBeenCalledWith(null);
  });

  it("selects a trash item and keeps the trash view active", () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const callbacks = createBaseCallbacks();

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: null,
        snapshot,
      }),
    );

    act(() => {
      result.current.trashWorkspaceProps.onSelectItem("draft:draft-trash");
    });

    expect(callbacks.onTrashSelectionChange).toHaveBeenCalledWith("draft:draft-trash");
    expect(callbacks.onViewChange).toHaveBeenCalledWith("trash");
  });

  it("restores a draft from a compact payload against the latest snapshot", async () => {
    const trashedDraft = createDraft({
      id: "draft-trash",
      title: "削除済み下書き",
      updatedAt: "30",
    });
    const trashedHistory = [
      createDraftHistoryEntry({
        id: "history-trash",
        draftId: "draft-trash",
        title: "削除済み下書き",
      }),
    ];
    const activeDraft = createDraft({
      id: "draft-live",
      title: "既存の下書き",
      updatedAt: "20",
    });
    const newerDraft = createDraft({
      id: "draft-newer",
      title: "あとから増えた下書き",
      updatedAt: "25",
    });
    const baseSnapshot = createStoreSnapshot({
      drafts: [activeDraft],
      draftHistory: [],
      templates: [createTemplate()],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [
          {
            draft: trashedDraft,
            history: trashedHistory,
            deletedAt: "40",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const latestSnapshot = {
      ...baseSnapshot,
      drafts: [activeDraft, newerDraft],
    };
    const callbacks = createBaseCallbacks();

    vi.spyOn(maildraftApi, "restoreDraftFromTrash").mockResolvedValue({
      draft: trashedDraft,
      draftHistory: trashedHistory,
    });

    const { result, rerender } = renderHook(
      ({ snapshot }) =>
        useTrashWorkspaceState({
          ...callbacks,
          selectedTrashItemKey: buildTrashItemKey("draft", trashedDraft.id),
          snapshot,
        }),
      {
        initialProps: {
          snapshot: baseSnapshot,
        },
      },
    );

    rerender({ snapshot: latestSnapshot });

    await act(async () => {
      await result.current.trashWorkspaceProps.onRestoreItem(result.current.trashItems[0]);
    });

    await waitFor(() => {
      expect(callbacks.onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = callbacks.onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.drafts.map((draft: { id: string }) => draft.id)).toEqual(
      expect.arrayContaining(["draft-live", "draft-newer", "draft-trash"]),
    );
    expect(nextSnapshot.trash.drafts).toHaveLength(0);
    expect(callbacks.onDraftRestored).toHaveBeenCalledWith("draft-trash", nextSnapshot);
    expect(callbacks.onViewChange).toHaveBeenCalledWith("drafts");
    expect(callbacks.onNotice).toHaveBeenCalledWith("下書きをゴミ箱から復元しました。");
  });

  it("restores a template from a compact payload", async () => {
    const activeTemplate = createTemplate({
      id: "template-live",
      name: "既存テンプレート",
      updatedAt: "10",
    });
    const trashedTemplate = createTemplate({
      id: "template-trash",
      name: "削除済みテンプレート",
      updatedAt: "20",
    });
    const snapshot = createStoreSnapshot({
      drafts: [],
      draftHistory: [],
      templates: [activeTemplate],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [],
        templates: [
          {
            template: trashedTemplate,
            deletedAt: "30",
          },
        ],
        signatures: [],
      },
    });
    const callbacks = createBaseCallbacks();

    vi.spyOn(maildraftApi, "restoreTemplateFromTrash").mockResolvedValue({
      template: trashedTemplate,
    });

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("template", trashedTemplate.id),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onRestoreItem(result.current.trashItems[0]);
    });

    await waitFor(() => {
      expect(callbacks.onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = callbacks.onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.templates.map((template: { id: string }) => template.id)).toEqual(
      expect.arrayContaining(["template-live", "template-trash"]),
    );
    expect(nextSnapshot.trash.templates).toHaveLength(0);
    expect(callbacks.onTemplateRestored).toHaveBeenCalledWith(nextSnapshot, "template-trash");
    expect(callbacks.onViewChange).toHaveBeenCalledWith("templates");
    expect(callbacks.onNotice).toHaveBeenCalledWith("テンプレートをゴミ箱から復元しました。");
  });

  it("restores a signature from a compact payload", async () => {
    const activeSignature = createSignature({
      id: "signature-live",
      name: "既存署名",
      isDefault: true,
      updatedAt: "10",
    });
    const trashedSignature = createSignature({
      id: "signature-trash",
      name: "削除済み署名",
      isDefault: false,
      updatedAt: "20",
    });
    const snapshot = createStoreSnapshot({
      drafts: [],
      draftHistory: [],
      templates: [createTemplate({ signatureId: "signature-live" })],
      signatures: [activeSignature],
      trash: {
        drafts: [],
        templates: [],
        signatures: [
          {
            signature: trashedSignature,
            deletedAt: "30",
          },
        ],
      },
    });
    const callbacks = createBaseCallbacks();

    vi.spyOn(maildraftApi, "restoreSignatureFromTrash").mockResolvedValue({
      signatures: [trashedSignature, activeSignature],
    });

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("signature", trashedSignature.id),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onRestoreItem(result.current.trashItems[0]);
    });

    await waitFor(() => {
      expect(callbacks.onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = callbacks.onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.signatures.map((signature: { id: string }) => signature.id)).toEqual(
      expect.arrayContaining(["signature-live", "signature-trash"]),
    );
    expect(nextSnapshot.trash.signatures).toHaveLength(0);
    expect(callbacks.onSignatureRestored).toHaveBeenCalledWith(nextSnapshot, "signature-trash");
    expect(callbacks.onViewChange).toHaveBeenCalledWith("signatures");
    expect(callbacks.onNotice).toHaveBeenCalledWith("署名をゴミ箱から復元しました。");
  });

  it("permanently deletes a signature after confirmation", async () => {
    const trashedSignature = createSignature({
      id: "signature-trash",
      name: "削除済み署名",
      isDefault: false,
      updatedAt: "20",
    });
    const nextSnapshot = createStoreSnapshot({
      drafts: [],
      draftHistory: [],
      templates: [createTemplate()],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    });
    const snapshot = {
      ...nextSnapshot,
      trash: {
        drafts: [],
        templates: [],
        signatures: [
          {
            signature: trashedSignature,
            deletedAt: "30",
          },
        ],
      },
    };
    const callbacks = createBaseCallbacks();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "permanentlyDeleteSignatureFromTrash").mockResolvedValue(nextSnapshot);

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("signature", trashedSignature.id),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onDeleteItemPermanently(result.current.trashItems[0]);
    });

    await waitFor(() => {
      expect(callbacks.onSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    });
    expect(callbacks.onSignatureSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(callbacks.onNotice).toHaveBeenCalledWith("署名を完全に削除しました。");
  });

  it("permanently deletes a draft after confirmation", async () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const nextSnapshot = {
      ...snapshot,
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    };
    const callbacks = createBaseCallbacks();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "permanentlyDeleteDraftFromTrash").mockResolvedValue(nextSnapshot);

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("draft", "draft-trash"),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onDeleteItemPermanently(result.current.trashItems[0]);
    });

    expect(callbacks.onSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(callbacks.onNotice).toHaveBeenCalledWith("下書きを完全に削除しました。");
  });

  it("permanently deletes a template after confirmation", async () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [],
        templates: [
          {
            template: createTemplate({ id: "template-trash", name: "削除済みテンプレート" }),
            deletedAt: "30",
          },
        ],
        signatures: [],
      },
    });
    const nextSnapshot = {
      ...snapshot,
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    };
    const callbacks = createBaseCallbacks();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "permanentlyDeleteTemplateFromTrash").mockResolvedValue(nextSnapshot);

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("template", "template-trash"),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onDeleteItemPermanently(result.current.trashItems[0]);
    });

    expect(callbacks.onSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(callbacks.onNotice).toHaveBeenCalledWith("テンプレートを完全に削除しました。");
  });

  it("skips permanent delete when confirmation is cancelled", async () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const deleteDraftSpy = vi.spyOn(maildraftApi, "permanentlyDeleteDraftFromTrash");

    confirmMock.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...createBaseCallbacks(),
        selectedTrashItemKey: buildTrashItemKey("draft", "draft-trash"),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onDeleteItemPermanently(result.current.trashItems[0]);
    });

    expect(deleteDraftSpy).not.toHaveBeenCalled();
  });

  it("empties trash after confirmation and clears the selection", async () => {
    const snapshot = createStoreSnapshot({
      drafts: [createDraft({ id: "draft-live" })],
      draftHistory: [],
      templates: [createTemplate()],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "20",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const nextSnapshot = {
      ...snapshot,
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    };
    const callbacks = createBaseCallbacks();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "emptyTrash").mockResolvedValue(nextSnapshot);

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("draft", "draft-trash"),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onEmptyTrash();
    });

    await waitFor(() => {
      expect(callbacks.onSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    });
    expect(callbacks.onTrashSelectionChange).toHaveBeenCalledWith(null);
    expect(callbacks.onSignatureSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(callbacks.onNotice).toHaveBeenCalledWith("ゴミ箱を空にしました。");
  });

  it("skips empty trash when confirmation is cancelled", async () => {
    const emptyTrashSpy = vi.spyOn(maildraftApi, "emptyTrash");

    confirmMock.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...createBaseCallbacks(),
        selectedTrashItemKey: null,
        snapshot: createStoreSnapshot(),
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onEmptyTrash();
    });

    expect(emptyTrashSpy).not.toHaveBeenCalled();
  });

  it("reports restore errors", async () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const callbacks = createBaseCallbacks();

    vi.spyOn(maildraftApi, "restoreDraftFromTrash").mockRejectedValue(new Error("restore failed"));

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("draft", "draft-trash"),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onRestoreItem(result.current.trashItems[0]);
    });

    expect(callbacks.onError).toHaveBeenCalledWith("restore failed");
  });

  it("reports permanent delete errors", async () => {
    const snapshot = createStoreSnapshot({
      trash: {
        drafts: [
          {
            draft: createDraft({ id: "draft-trash", title: "削除済み下書き" }),
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
      },
    });
    const callbacks = createBaseCallbacks();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "permanentlyDeleteDraftFromTrash").mockRejectedValue(
      new Error("delete failed"),
    );

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: buildTrashItemKey("draft", "draft-trash"),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onDeleteItemPermanently(result.current.trashItems[0]);
    });

    expect(callbacks.onError).toHaveBeenCalledWith("delete failed");
  });

  it("reports empty trash errors", async () => {
    const callbacks = createBaseCallbacks();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "emptyTrash").mockRejectedValue(new Error("empty failed"));

    const { result } = renderHook(() =>
      useTrashWorkspaceState({
        ...callbacks,
        selectedTrashItemKey: null,
        snapshot: createStoreSnapshot(),
      }),
    );

    await act(async () => {
      await result.current.trashWorkspaceProps.onEmptyTrash();
    });

    expect(callbacks.onError).toHaveBeenCalledWith("empty failed");
  });
});

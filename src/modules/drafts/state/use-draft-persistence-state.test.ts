import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  createDraft,
  createDraftHistoryEntry,
  createSignature,
  createStoreSnapshot,
  createTemplate,
} from "../../../test/ui-fixtures";
import { useDraftPersistenceState } from "./use-draft-persistence-state";

const autoSaveMocks = vi.hoisted(() => ({
  flushPendingDraft: vi.fn(),
  saveDraft: vi.fn(),
  setDraftAutoSaveState: vi.fn(),
}));

vi.mock("./use-draft-auto-save", () => ({
  useDraftAutoSave: () => ({
    draftAutoSaveState: "saved" as const,
    ...autoSaveMocks,
  }),
}));

describe("draft persistence state", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies a compact delete payload and selects the next draft", async () => {
    const deletedDraft = createDraft({
      id: "draft-delete",
      title: "削除する下書き",
      updatedAt: "20",
    });
    const remainingDraft = createDraft({
      id: "draft-keep",
      title: "残る下書き",
      updatedAt: "10",
    });
    const deletedHistory = createDraftHistoryEntry({
      id: "history-delete",
      draftId: "draft-delete",
      title: "削除する下書き",
    });
    const snapshot = createStoreSnapshot({
      drafts: [deletedDraft, remainingDraft],
      draftHistory: [
        deletedHistory,
        createDraftHistoryEntry({
          id: "history-keep",
          draftId: "draft-keep",
          title: "残る下書き",
        }),
      ],
      templates: [createTemplate()],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    });
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "deleteDraft").mockResolvedValue({
      trashedDraft: {
        draft: deletedDraft,
        history: [deletedHistory],
        deletedAt: "30",
      },
    });

    const { result } = renderHook(() =>
      useDraftPersistenceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice,
        onResetVariablePresetSelection: vi.fn(),
        onSnapshotChange,
        snapshot,
      }),
    );

    expect(result.current.selectedDraftId).toBe("draft-delete");

    await act(async () => {
      await result.current.deleteDraft();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.drafts.map((draft: { id: string }) => draft.id)).toEqual(["draft-keep"]);
    expect(
      nextSnapshot.draftHistory.map((entry: { draftId: string }) => entry.draftId),
    ).toEqual(["draft-keep"]);
    expect(nextSnapshot.trash.drafts[0]?.draft.id).toBe("draft-delete");

    await waitFor(() => {
      expect(result.current.selectedDraftId).toBe("draft-keep");
    });
    expect(result.current.draftForm.id).toBe("draft-keep");
    expect(autoSaveMocks.setDraftAutoSaveState).toHaveBeenCalledWith("saved");
    expect(onNotice).toHaveBeenCalledWith("下書きをゴミ箱に移動しました。");
  });

  it("duplicates the active draft through a compact save payload", async () => {
    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000003");
    const snapshot = createStoreSnapshot({
      drafts: [
        createDraft({
          id: "draft-source",
          title: "複製元の下書き",
          updatedAt: "20",
        }),
      ],
      draftHistory: [],
      templates: [createTemplate()],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    });
    const duplicatedDraft = createDraft({
      id: "00000000-0000-4000-8000-000000000003",
      title: "複製元の下書き コピー",
      updatedAt: "30",
    });
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    const saveDraftSpy = vi.spyOn(maildraftApi, "saveDraft").mockResolvedValue({
      draft: duplicatedDraft,
      draftHistory: [],
    });

    const { result } = renderHook(
      ({ currentSnapshot }) =>
        useDraftPersistenceState({
          onClearError: vi.fn(),
          onError: vi.fn(),
          onNotice,
          onResetVariablePresetSelection: vi.fn(),
          onSnapshotChange,
          snapshot: currentSnapshot,
        }),
      {
        initialProps: {
          currentSnapshot: snapshot,
        },
      },
    );

    await act(async () => {
      await result.current.duplicateDraft();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.drafts.map((draft: { id: string }) => draft.id)).toEqual([
      "00000000-0000-4000-8000-000000000003",
      "draft-source",
    ]);
    expect(saveDraftSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000003",
        isPinned: false,
        title: "複製元の下書き コピー",
      }),
    );
    expect(autoSaveMocks.setDraftAutoSaveState).toHaveBeenCalledWith("saved");
    expect(onNotice).toHaveBeenCalledWith("下書きを複製しました。");
    randomUuidSpy.mockRestore();
  });

  it("restores draft history through a compact save payload", async () => {
    const snapshot = createStoreSnapshot({
      drafts: [
        createDraft({
          id: "draft-restore",
          title: "復元対象",
          subject: "更新後の件名",
          body: "更新後の本文",
          updatedAt: "20",
        }),
      ],
      draftHistory: [
        createDraftHistoryEntry({
          id: "history-old",
          draftId: "draft-restore",
          title: "復元対象",
          subject: "元の件名",
          body: "元の本文",
          recordedAt: "10",
        }),
        createDraftHistoryEntry({
          id: "history-new",
          draftId: "draft-restore",
          title: "復元対象",
          subject: "更新後の件名",
          body: "更新後の本文",
          recordedAt: "20",
        }),
      ],
      templates: [createTemplate()],
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    });
    const restoredDraft = createDraft({
      id: "draft-restore",
      title: "復元対象",
      subject: "元の件名",
      body: "元の本文",
      updatedAt: "30",
    });
    const restoredHistory = [
      createDraftHistoryEntry({
        id: "history-restored",
        draftId: "draft-restore",
        title: "復元対象",
        subject: "元の件名",
        body: "元の本文",
        recordedAt: "30",
      }),
      createDraftHistoryEntry({
        id: "history-old",
        draftId: "draft-restore",
        title: "復元対象",
        subject: "元の件名",
        body: "元の本文",
        recordedAt: "10",
      }),
    ];
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    const restoreDraftHistorySpy = vi
      .spyOn(maildraftApi, "restoreDraftHistory")
      .mockResolvedValue({
        draft: restoredDraft,
        draftHistory: restoredHistory,
      });

    const { result } = renderHook(() =>
      useDraftPersistenceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice,
        onResetVariablePresetSelection: vi.fn(),
        onSnapshotChange,
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.restoreDraftHistory("history-old");
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(restoreDraftHistorySpy).toHaveBeenCalledWith("draft-restore", "history-old");
    expect(nextSnapshot.drafts[0]).toMatchObject({
      id: "draft-restore",
      subject: "元の件名",
      body: "元の本文",
    });
    expect(
      nextSnapshot.draftHistory.map((entry: { id: string }) => entry.id),
    ).toEqual(["history-restored", "history-old"]);
    expect(result.current.draftForm.subject).toBe("元の件名");
    expect(autoSaveMocks.setDraftAutoSaveState).toHaveBeenCalledWith("saved");
    expect(onNotice).toHaveBeenCalledWith("履歴から下書きを復元しました。");
  });
});

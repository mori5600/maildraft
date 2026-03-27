import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMemo, createSignature, createStoreSnapshot } from "../../../test/ui-fixtures";
import { buildTrashItemKey } from "../../trash/model";

const { deleteMemoMock } = vi.hoisted(() => ({
  deleteMemoMock: vi.fn(),
}));

vi.mock("../../../shared/api/maildraft-api", () => ({
  maildraftApi: {
    deleteMemo: deleteMemoMock,
  },
}));

import { useMemoWorkspaceState } from "./use-memo-workspace-state";

const memoAutoSaveMocks = vi.hoisted(() => ({
  flushPendingMemo: vi.fn(),
  saveMemo: vi.fn(),
}));

vi.mock("./use-memo-auto-save", () => ({
  useMemoAutoSave: () => ({
    autoSaveLabel: "自動保存済み",
    ...memoAutoSaveMocks,
  }),
}));

describe("memo workspace state", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts a new draft from the latest memo form state", () => {
    const snapshot = createStoreSnapshot({
      signatures: [createSignature({ id: "signature-1", isDefault: true })],
      memos: [
        createMemo({
          id: "memo-1",
          title: "打ち合わせメモ",
          body: "確認事項",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    const onOpenDraftInput = vi.fn();
    const onNotice = vi.fn();
    const onViewChange = vi.fn();

    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice,
        onOpenDraftInput,
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot,
      }),
    );

    act(() => {
      result.current.memoWorkspaceProps.onChangeMemo("body", "確認事項\n宿題");
    });

    act(() => {
      result.current.memoWorkspaceProps.onStartDraftFromMemo();
    });

    expect(memoAutoSaveMocks.flushPendingMemo).toHaveBeenCalledTimes(1);
    expect(onOpenDraftInput).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "打ち合わせメモ",
        subject: "",
        body: "確認事項\n宿題",
        templateId: null,
        signatureId: "signature-1",
      }),
    );
    expect(onViewChange).toHaveBeenCalledWith("drafts");
    expect(onNotice).toHaveBeenCalledWith("メモから新しい下書きを起こしました。");
  });

  it("does not start a draft from an empty memo", () => {
    const onOpenDraftInput = vi.fn();
    const onViewChange = vi.fn();

    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput,
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot: createStoreSnapshot({
          memos: [],
          trash: {
            drafts: [],
            templates: [],
            signatures: [],
            memos: [],
          },
        }),
      }),
    );

    expect(result.current.memoWorkspaceProps.canStartDraftFromMemo).toBe(false);

    act(() => {
      result.current.memoWorkspaceProps.onStartDraftFromMemo();
    });

    expect(memoAutoSaveMocks.flushPendingMemo).not.toHaveBeenCalled();
    expect(onOpenDraftInput).not.toHaveBeenCalled();
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("toggles the pinned state on the memo form", () => {
    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot: createStoreSnapshot({
          memos: [
            createMemo({
              id: "memo-1",
              title: "",
              body: "",
              isPinned: false,
            }),
          ],
        }),
      }),
    );

    expect(result.current.memoWorkspaceProps.memoForm.isPinned).toBe(false);

    act(() => {
      result.current.memoWorkspaceProps.onTogglePinned();
    });

    expect(result.current.memoWorkspaceProps.memoForm.isPinned).toBe(true);
    expect(result.current.memoWorkspaceProps.canStartDraftFromMemo).toBe(false);
  });

  it("selects another memo, flushes pending edits, and keeps the memo view active", () => {
    const snapshot = createStoreSnapshot({
      memos: [
        createMemo({
          id: "memo-1",
          title: "一件目",
          body: "本文1",
          updatedAt: "10",
        }),
        createMemo({
          id: "memo-2",
          title: "二件目",
          body: "本文2",
          updatedAt: "20",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    const onViewChange = vi.fn();

    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot,
      }),
    );

    act(() => {
      result.current.memoWorkspaceProps.onSelectMemo("memo-2");
    });

    expect(memoAutoSaveMocks.flushPendingMemo).toHaveBeenCalledTimes(1);
    expect(result.current.memoWorkspaceProps.selectedMemoId).toBe("memo-2");
    expect(result.current.memoWorkspaceProps.memoForm).toMatchObject({
      id: "memo-2",
      title: "二件目",
      body: "本文2",
    });
    expect(onViewChange).toHaveBeenCalledWith("memo");
  });

  it("ignores missing memo selections without discarding the current edit", () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot: createStoreSnapshot({
          memos: [
            createMemo({
              id: "memo-1",
              title: "編集中",
              body: "元の本文",
              updatedAt: "10",
            }),
          ],
          trash: {
            drafts: [],
            templates: [],
            signatures: [],
            memos: [],
          },
        }),
      }),
    );

    act(() => {
      result.current.memoWorkspaceProps.onChangeMemo("body", "編集中の本文");
    });

    act(() => {
      result.current.memoWorkspaceProps.onSelectMemo("missing");
    });

    expect(memoAutoSaveMocks.flushPendingMemo).toHaveBeenCalledTimes(1);
    expect(result.current.memoWorkspaceProps.selectedMemoId).toBe("memo-1");
    expect(result.current.memoWorkspaceProps.memoForm.body).toBe("編集中の本文");
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("creates a new memo, resets the form, and can hydrate a preferred memo later", () => {
    const onNotice = vi.fn();
    const onViewChange = vi.fn();
    const snapshot = createStoreSnapshot({
      memos: [
        createMemo({
          id: "memo-1",
          title: "既存メモ",
          body: "既存本文",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot,
      }),
    );

    act(() => {
      result.current.createMemo();
    });

    expect(memoAutoSaveMocks.flushPendingMemo).toHaveBeenCalledTimes(1);
    expect(result.current.memoWorkspaceProps.selectedMemoId).toBeNull();
    expect(result.current.memoWorkspaceProps.memoForm.title).toBe("");
    expect(result.current.memoWorkspaceProps.memoForm.body).toBe("");
    expect(onViewChange).toHaveBeenCalledWith("memo");
    expect(onNotice).toHaveBeenCalledWith("新しいメモを作成しています。");

    act(() => {
      result.current.hydrateMemoState(snapshot, "memo-1");
    });

    expect(result.current.memoWorkspaceProps.selectedMemoId).toBe("memo-1");
    expect(result.current.memoWorkspaceProps.memoForm.title).toBe("既存メモ");
  });

  it("hydrates from the latest snapshot and uses the refreshed default signature", () => {
    const onOpenDraftInput = vi.fn();
    const onViewChange = vi.fn();
    const initialSnapshot = createStoreSnapshot({
      signatures: [createSignature({ id: "signature-initial", isDefault: true })],
      memos: [
        createMemo({
          id: "memo-initial",
          title: "初期メモ",
          body: "初期本文",
          updatedAt: "10",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    const nextSnapshot = createStoreSnapshot({
      signatures: [createSignature({ id: "signature-next", isDefault: true })],
      memos: [
        createMemo({
          id: "memo-next",
          title: "差し替え後",
          body: "最新本文",
          updatedAt: "30",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: ReturnType<typeof createStoreSnapshot> }) =>
        useMemoWorkspaceState({
          onClearError: vi.fn(),
          onError: vi.fn(),
          onNotice: vi.fn(),
          onOpenDraftInput,
          onSnapshotChange: vi.fn(),
          onTrashItemSelect: vi.fn(),
          onViewChange,
          snapshot,
        }),
      {
        initialProps: {
          snapshot: initialSnapshot,
        },
      },
    );

    rerender({ snapshot: nextSnapshot });

    act(() => {
      result.current.hydrateMemoState(nextSnapshot, "missing");
    });

    expect(result.current.memoWorkspaceProps.selectedMemoId).toBe("memo-next");
    expect(result.current.memoWorkspaceProps.activeMemoUpdatedAt).toBe("30");

    act(() => {
      result.current.memoWorkspaceProps.onStartDraftFromMemo();
    });

    expect(memoAutoSaveMocks.flushPendingMemo).toHaveBeenCalledTimes(1);
    expect(onOpenDraftInput).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "差し替え後",
        body: "最新本文",
        signatureId: "signature-next",
      }),
    );
    expect(onViewChange).toHaveBeenCalledWith("drafts");
  });

  it("filters memos by search query and sort order", () => {
    const snapshot = createStoreSnapshot({
      memos: [
        createMemo({
          id: "memo-1",
          title: "議事録",
          body: "Alpha",
          tags: ["会議"],
          updatedAt: "10",
        }),
        createMemo({
          id: "memo-2",
          title: "候補",
          body: "Bravo",
          tags: ["議事録"],
          updatedAt: "20",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    act(() => {
      result.current.memoWorkspaceProps.onChangeSearchQuery("Bravo");
      result.current.memoWorkspaceProps.onChangeSort("label");
    });

    expect(result.current.memoWorkspaceProps.searchQuery).toBe("Bravo");
    expect(result.current.memoWorkspaceProps.sort).toBe("label");
    expect(result.current.memoWorkspaceProps.memos.map((memo) => memo.id)).toEqual(["memo-2"]);
    expect(result.current.memoWorkspaceProps.totalMemoCount).toBe(2);

    act(() => {
      result.current.memoWorkspaceProps.onChangeSearchQuery("");
      result.current.memoWorkspaceProps.onChangeTagFilter("会議");
    });

    expect(result.current.memoWorkspaceProps.activeTagFilter).toBe("会議");
    expect(result.current.memoWorkspaceProps.availableTags).toEqual(["会議", "議事録"]);
    expect(result.current.memoWorkspaceProps.memos.map((memo) => memo.id)).toEqual(["memo-1"]);
  });

  it("deletes the selected memo through a compact payload", async () => {
    const snapshot = createStoreSnapshot({
      memos: [
        createMemo({
          id: "memo-1",
          title: "削除対象",
          body: "本文",
          updatedAt: "10",
        }),
        createMemo({
          id: "memo-2",
          title: "残るメモ",
          body: "残る本文",
          updatedAt: "20",
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    const onClearError = vi.fn();
    const onNotice = vi.fn();
    const onSnapshotChange = vi.fn();
    const onTrashItemSelect = vi.fn();

    deleteMemoMock.mockResolvedValue({
      trashedMemo: {
        memo: snapshot.memos[0],
        deletedAt: "30",
      },
    });

    const { result } = renderHook(() =>
      useMemoWorkspaceState({
        onClearError,
        onError: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange,
        onTrashItemSelect,
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.memoWorkspaceProps.onDeleteMemo();
    });

    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(deleteMemoMock).toHaveBeenCalledWith("memo-1");
    expect(onSnapshotChange).toHaveBeenCalledWith(
      expect.objectContaining({
        memos: [expect.objectContaining({ id: "memo-2" })],
      }),
    );
    expect(result.current.memoWorkspaceProps.selectedMemoId).toBe("memo-2");
    expect(result.current.memoWorkspaceProps.memoForm.title).toBe("残るメモ");
    expect(onTrashItemSelect).toHaveBeenCalledWith(buildTrashItemKey("memo", "memo-1"));
    expect(onNotice).toHaveBeenCalledWith("メモをゴミ箱に移動しました。");
  });

  it("resets an unsaved memo and reports delete failures", async () => {
    const onError = vi.fn();
    const onNotice = vi.fn();

    deleteMemoMock.mockRejectedValue("削除できません");

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: ReturnType<typeof createStoreSnapshot> }) =>
        useMemoWorkspaceState({
          onClearError: vi.fn(),
          onError,
          onNotice,
          onOpenDraftInput: vi.fn(),
          onSnapshotChange: vi.fn(),
          onTrashItemSelect: vi.fn(),
          onViewChange: vi.fn(),
          snapshot,
        }),
      {
        initialProps: {
          snapshot: createStoreSnapshot({
            memos: [],
            trash: {
              drafts: [],
              templates: [],
              signatures: [],
              memos: [],
            },
          }),
        },
      },
    );

    act(() => {
      result.current.memoWorkspaceProps.onChangeMemo("title", "未保存");
      result.current.memoWorkspaceProps.onChangeMemo("body", "本文");
    });

    await act(async () => {
      await result.current.memoWorkspaceProps.onDeleteMemo();
    });

    expect(result.current.memoWorkspaceProps.selectedMemoId).toBeNull();
    expect(result.current.memoWorkspaceProps.memoForm.title).toBe("");
    expect(result.current.memoWorkspaceProps.memoForm.body).toBe("");
    expect(onNotice).toHaveBeenCalledWith("編集中のメモをリセットしました。");

    rerender({
      snapshot: createStoreSnapshot({
        memos: [createMemo({ id: "memo-1", title: "保存済み", body: "本文" })],
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
          memos: [],
        },
      }),
    });

    act(() => {
      result.current.memoWorkspaceProps.onSelectMemo("memo-1");
    });

    await act(async () => {
      await result.current.memoWorkspaceProps.onDeleteMemo();
    });

    expect(onError).toHaveBeenCalledWith("削除できません");
  });
});

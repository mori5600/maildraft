import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMemo, createSignature, createStoreSnapshot } from "../../../test/ui-fixtures";
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
});

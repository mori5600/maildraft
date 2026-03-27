import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMemo, createMemoInput, createStoreSnapshot } from "../../../test/ui-fixtures";

const { saveMemoMock } = vi.hoisted(() => ({
  saveMemoMock: vi.fn(),
}));

vi.mock("../../../shared/api/maildraft-api", () => ({
  maildraftApi: {
    saveMemo: saveMemoMock,
  },
}));

import { useMemoAutoSave } from "./use-memo-auto-save";

interface MemoAutoSaveHarnessOptions {
  initialAutoSaveState?: "idle" | "dirty" | "saving" | "saved" | "error";
  initialMemoForm?: ReturnType<typeof createMemoInput>;
  initialSelectedMemoId?: string | null;
  initialSnapshot?: ReturnType<typeof createStoreSnapshot>;
}

function renderMemoAutoSaveHarness({
  initialAutoSaveState = "saved",
  initialMemoForm = createMemoInput({
    id: "memo-1",
    title: "打ち合わせメモ",
    body: "更新前",
  }),
  initialSelectedMemoId = "memo-1",
  initialSnapshot = createStoreSnapshot({
    memos: [
      createMemo({
        id: "memo-1",
        title: "打ち合わせメモ",
        body: "更新前",
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
}: MemoAutoSaveHarnessOptions = {}) {
  const onClearError = vi.fn();
  const onError = vi.fn();
  const onNotice = vi.fn();

  const hook = renderHook(() => {
    const [snapshot, setSnapshot] = useState(initialSnapshot);
    const [memoForm, setMemoForm] = useState(initialMemoForm);
    const [selectedMemoId, setSelectedMemoId] = useState(initialSelectedMemoId);
    const memoFormRef = useRef(memoForm);
    memoFormRef.current = memoForm;
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    const autoSave = useMemoAutoSave({
      initialAutoSaveState,
      memoForm,
      memoFormRef,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange: setSnapshot,
      selectedMemoId,
      setMemoForm,
      setSelectedMemoId,
      snapshot,
      snapshotRef,
    });

    return {
      ...autoSave,
      memoForm,
      selectedMemoId,
      setMemoForm,
      snapshot,
    };
  });

  return {
    ...hook,
    onClearError,
    onError,
    onNotice,
  };
}

describe("memo auto save", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("autosaves a dirty memo after the debounce interval", async () => {
    vi.useFakeTimers();
    saveMemoMock.mockResolvedValue(
      createMemo({
        id: "memo-1",
        title: "打ち合わせメモ",
        body: "更新前",
        tags: ["議事録"],
        updatedAt: "20",
      }),
    );

    const { result, onNotice } = renderMemoAutoSaveHarness({
      initialMemoForm: createMemoInput({
        id: "memo-1",
        title: "打ち合わせメモ",
        body: "更新前",
        tags: ["議事録"],
      }),
    });

    expect(result.current.autoSaveLabel).toBe("未保存の変更があります");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await Promise.resolve();
    });

    expect(saveMemoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "memo-1",
        tags: ["議事録"],
      }),
    );
    expect(result.current.autoSaveLabel).toBe("自動保存済み");
    expect(result.current.snapshot.memos[0]?.tags).toEqual(["議事録"]);
    expect(result.current.memoForm.tags).toEqual(["議事録"]);
    expect(result.current.selectedMemoId).toBe("memo-1");
    expect(onNotice).not.toHaveBeenCalled();
  });

  it("manually saves a memo, clears old errors, and shows a notice", async () => {
    saveMemoMock.mockResolvedValue(
      createMemo({
        id: "memo-2",
        title: "新規メモ",
        body: "本文",
        updatedAt: "20",
      }),
    );

    const { result, onClearError, onNotice } = renderMemoAutoSaveHarness({
      initialAutoSaveState: "idle",
      initialMemoForm: createMemoInput({
        id: "memo-2",
        title: "新規メモ",
        body: "本文",
      }),
      initialSelectedMemoId: null,
      initialSnapshot: createStoreSnapshot({
        memos: [],
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
          memos: [],
        },
      }),
    });

    await act(async () => {
      await result.current.saveMemo();
    });

    await waitFor(() => {
      expect(result.current.snapshot.memos[0]?.id).toBe("memo-2");
    });
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith("メモを保存しました。");
    expect(result.current.selectedMemoId).toBe("memo-2");
    expect(result.current.memoForm.id).toBe("memo-2");
  });

  it("reports auto-save failures for the active memo", async () => {
    vi.useFakeTimers();
    saveMemoMock.mockRejectedValue(new Error("保存に失敗しました"));

    const { result, onError } = renderMemoAutoSaveHarness({
      initialMemoForm: createMemoInput({
        id: "memo-1",
        title: "打ち合わせメモ",
        body: "失敗する更新",
      }),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith("保存に失敗しました");
    expect(result.current.autoSaveLabel).toBe("自動保存に失敗しました");
  });

  it("flushes only dirty memos and skips empty or unchanged forms", async () => {
    saveMemoMock.mockResolvedValue(
      createMemo({
        id: "memo-1",
        title: "打ち合わせメモ",
        body: "flush 更新",
        updatedAt: "20",
      }),
    );

    const dirty = renderMemoAutoSaveHarness({
      initialMemoForm: createMemoInput({
        id: "memo-1",
        title: "打ち合わせメモ",
        body: "flush 更新",
      }),
    });

    await act(async () => {
      dirty.result.current.flushPendingMemo();
    });

    await waitFor(() => {
      expect(saveMemoMock).toHaveBeenCalledTimes(1);
    });

    saveMemoMock.mockClear();

    const clean = renderMemoAutoSaveHarness();
    await act(async () => {
      clean.result.current.flushPendingMemo();
    });
    expect(saveMemoMock).not.toHaveBeenCalled();

    const empty = renderMemoAutoSaveHarness({
      initialAutoSaveState: "idle",
      initialMemoForm: createMemoInput({
        id: "memo-empty",
        title: "",
        body: "",
        isPinned: false,
      }),
      initialSelectedMemoId: null,
      initialSnapshot: createStoreSnapshot({
        memos: [],
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
          memos: [],
        },
      }),
    });
    await act(async () => {
      empty.result.current.flushPendingMemo();
    });
    expect(saveMemoMock).not.toHaveBeenCalled();
  });
});

import { afterAll, describe, expect, it, vi } from "vitest";

import type { StoreSnapshot } from "../../../shared/types/store";
import {
  buildMemoEditingState,
  createInitialMemoState,
  filterMemos,
  formatMemoAutoSaveState,
  getMemoUpdatedAt,
  shouldAutoPersistMemo,
  toMemoWorkspaceErrorMessage,
} from "./memo-workspace-helpers";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000005");

const snapshot: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  templates: [],
  signatures: [],
  memos: [
    {
      id: "memo-1",
      title: "商談メモ",
      isPinned: true,
      body: "確認事項を整理する",
      tags: ["会議"],
      createdAt: "1",
      updatedAt: "10",
    },
    {
      id: "memo-2",
      title: "",
      isPinned: false,
      body: "会話ログ\nA社",
      tags: ["議事録"],
      createdAt: "1",
      updatedAt: "5",
    },
  ],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

describe("memo workspace helpers", () => {
  it("builds initial and selected editing state from the snapshot", () => {
    expect(createInitialMemoState(snapshot)).toMatchObject({
      autoSaveState: "saved",
      selectedMemoId: "memo-1",
      memoForm: {
        id: "memo-1",
        title: "商談メモ",
        isPinned: true,
      },
    });

    expect(buildMemoEditingState(snapshot, "memo-2")).toMatchObject({
      selectedMemoId: "memo-2",
      memoForm: {
        id: "memo-2",
        isPinned: false,
        body: "会話ログ\nA社",
      },
    });

    expect(
      createInitialMemoState({
        ...snapshot,
        memos: [],
      }),
    ).toMatchObject({
      autoSaveState: "idle",
      selectedMemoId: null,
      memoForm: {
        id: "00000000-0000-4000-8000-000000000005",
        title: "",
        isPinned: false,
        body: "",
      },
    });
  });

  it("filters, sorts, and inspects memo persistence state", () => {
    expect(filterMemos(snapshot.memos, "", "recent").map((memo) => memo.id)).toEqual([
      "memo-1",
      "memo-2",
    ]);
    expect(filterMemos(snapshot.memos, "A社", "recent").map((memo) => memo.id)).toEqual(["memo-2"]);
    expect(filterMemos(snapshot.memos, "会議", "recent").map((memo) => memo.id)).toEqual([
      "memo-1",
    ]);
    expect(filterMemos(snapshot.memos, "", "recent", "議事録").map((memo) => memo.id)).toEqual([
      "memo-2",
    ]);
    expect(getMemoUpdatedAt(snapshot.memos, "memo-2")).toBe("5");
    expect(getMemoUpdatedAt(snapshot.memos, "missing")).toBeNull();

    expect(
      shouldAutoPersistMemo(
        {
          id: "memo-3",
          title: "",
          isPinned: false,
          body: "",
          tags: [],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistMemo(
        {
          id: "memo-1",
          title: "商談メモ",
          isPinned: true,
          body: "確認事項を整理する",
          tags: ["会議"],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistMemo(
        {
          id: "memo-1",
          title: "商談メモ",
          isPinned: true,
          body: "更新後の本文",
          tags: [],
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("formats auto-save states and normalizes unknown errors", () => {
    expect(formatMemoAutoSaveState("idle")).toBe("自動保存待機中");
    expect(formatMemoAutoSaveState("dirty")).toBe("未保存の変更があります");
    expect(formatMemoAutoSaveState("saving")).toBe("自動保存しています");
    expect(formatMemoAutoSaveState("saved")).toBe("自動保存済み");
    expect(formatMemoAutoSaveState("error")).toBe("自動保存に失敗しました");

    expect(toMemoWorkspaceErrorMessage(new Error("保存に失敗しました"))).toBe("保存に失敗しました");
    expect(toMemoWorkspaceErrorMessage("読み込みに失敗しました")).toBe("読み込みに失敗しました");
    expect(toMemoWorkspaceErrorMessage({ reason: "unknown" })).toBe("処理に失敗しました。");
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

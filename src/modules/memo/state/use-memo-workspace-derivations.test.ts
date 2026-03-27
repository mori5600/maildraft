import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMemo, createMemoInput, createStoreSnapshot } from "../../../test/ui-fixtures";
import { useMemoWorkspaceDerivations } from "./use-memo-workspace-derivations";

describe("useMemoWorkspaceDerivations", () => {
  it("derives available tags, filtered memos, updated time, and draft eligibility", () => {
    const snapshot = createStoreSnapshot({
      memos: [
        createMemo({
          id: "memo-1",
          title: "議事録",
          body: "確認事項",
          tags: ["会議"],
          updatedAt: "10",
        }),
        createMemo({
          id: "memo-2",
          title: "候補者連絡",
          body: "採用案内",
          tags: ["採用"],
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
      useMemoWorkspaceDerivations({
        deferredMemoSearchQuery: "採用",
        memoForm: createMemoInput({
          title: "下書き化したいメモ",
          body: "",
        }),
        memoSort: "label",
        requestedTagFilter: "採用",
        selectedMemoId: "memo-2",
        snapshot,
      }),
    );

    expect(result.current.availableMemoTags).toEqual(["会議", "採用"]);
    expect(result.current.activeMemoTagFilter).toBe("採用");
    expect(result.current.filteredMemos.map((memo) => memo.id)).toEqual(["memo-2"]);
    expect(result.current.selectedMemoUpdatedAt).toBe("20");
    expect(result.current.canStartDraftFromMemo).toBe(true);
  });

  it("clears an invalid requested tag filter and reports empty draft eligibility", () => {
    const snapshot = createStoreSnapshot({
      memos: [
        createMemo({
          id: "memo-1",
          tags: ["会議"],
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
      useMemoWorkspaceDerivations({
        deferredMemoSearchQuery: "",
        memoForm: createMemoInput({
          title: "   ",
          body: "   ",
        }),
        memoSort: "recent",
        requestedTagFilter: "採用",
        selectedMemoId: "missing",
        snapshot,
      }),
    );

    expect(result.current.activeMemoTagFilter).toBeNull();
    expect(result.current.selectedMemoUpdatedAt).toBeNull();
    expect(result.current.canStartDraftFromMemo).toBe(false);
  });
});

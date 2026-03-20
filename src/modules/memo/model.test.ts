import { afterAll, describe, expect, it, vi } from "vitest";

import {
  createEmptyMemo,
  memoCharacterCount,
  memoExcerpt,
  memoHasDraftContent,
  memoHasMeaningfulContent,
  memoLabel,
  memoLineCount,
  memoMatchesPersistedMemo,
  toMemoInput,
} from "./model";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000004");

describe("memo model", () => {
  it("creates an empty memo and converts persisted memos back to input", () => {
    expect(createEmptyMemo()).toEqual({
      id: "00000000-0000-4000-8000-000000000004",
      title: "",
      isPinned: false,
      body: "",
    });

    expect(
      toMemoInput({
        id: "memo-1",
        title: "商談メモ",
        isPinned: true,
        body: "確認事項",
        createdAt: "1",
        updatedAt: "2",
      }),
    ).toEqual({
      id: "memo-1",
      title: "商談メモ",
      isPinned: true,
      body: "確認事項",
    });
  });

  it("derives memo labels, excerpts, and editor metrics", () => {
    const titledMemo = {
      title: "商談メモ",
      isPinned: false,
      body: "1行目\n2行目",
    };
    const untitledMemo = {
      title: "",
      isPinned: false,
      body: "\n 会話ログ \n次の行",
    };

    expect(memoLabel(titledMemo)).toBe("商談メモ");
    expect(memoLabel(untitledMemo)).toBe("会話ログ");
    expect(memoExcerpt(titledMemo)).toBe("1行目");
    expect(memoExcerpt(untitledMemo)).toBe("空のメモ");
    expect(memoLineCount(titledMemo)).toBe(2);
    expect(memoLineCount({ title: "", body: "" })).toBe(1);
    expect(memoCharacterCount(titledMemo)).toBe("商談メモ1行目\n2行目".length);
  });

  it("detects meaningful content and persisted equality", () => {
    const emptyMemo = {
      id: "memo-1",
      title: "",
      isPinned: false,
      body: "",
    };

    expect(memoHasMeaningfulContent(emptyMemo)).toBe(false);
    expect(memoHasMeaningfulContent({ ...emptyMemo, isPinned: true })).toBe(true);
    expect(memoHasMeaningfulContent({ ...emptyMemo, body: "本文" })).toBe(true);
    expect(memoHasDraftContent(emptyMemo)).toBe(false);
    expect(memoHasDraftContent({ ...emptyMemo, isPinned: true })).toBe(false);
    expect(memoHasDraftContent({ ...emptyMemo, body: "本文" })).toBe(true);
    expect(
      memoMatchesPersistedMemo(
        { ...emptyMemo, title: "商談メモ", isPinned: true, body: "本文" },
        {
          id: "memo-1",
          title: "商談メモ",
          isPinned: true,
          body: "本文",
          createdAt: "1",
          updatedAt: "2",
        },
      ),
    ).toBe(true);
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

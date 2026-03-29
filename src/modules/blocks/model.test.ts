import { describe, expect, it } from "vitest";

import {
  contentBlockCategoryLabel,
  contentBlockHasMeaningfulContent,
  contentBlockLabel,
  createEmptyContentBlock,
  duplicateContentBlockInput,
} from "./model";

describe("blocks model", () => {
  it("creates an empty block with the default category", () => {
    expect(createEmptyContentBlock()).toMatchObject({
      name: "新しいブロック",
      category: "other",
      body: "",
      tags: [],
    });
  });

  it("duplicates a block with a copy suffix", () => {
    expect(
      duplicateContentBlockInput({
        id: "block-1",
        name: "依頼",
        category: "request",
        body: "ご確認ください。",
        tags: ["社外"],
      }),
    ).toMatchObject({
      name: "依頼 コピー",
      category: "request",
      body: "ご確認ください。",
      tags: ["社外"],
    });
  });

  it("treats body or tags as meaningful content", () => {
    expect(
      contentBlockHasMeaningfulContent({
        id: "block-1",
        name: "新しいブロック",
        category: "other",
        body: "",
        tags: [],
      }),
    ).toBe(false);
    expect(
      contentBlockHasMeaningfulContent({
        id: "block-1",
        name: "新しいブロック",
        category: "other",
        body: "",
        tags: ["催促"],
      }),
    ).toBe(true);
  });

  it("prefers the explicit name and falls back to the first body line", () => {
    expect(contentBlockLabel({ name: "依頼", body: "本文" })).toBe("依頼");
    expect(contentBlockLabel({ name: "", body: "一行目\n二行目" })).toBe("一行目");
  });

  it("exposes Japanese labels for categories", () => {
    expect(contentBlockCategoryLabel("greeting")).toBe("挨拶");
    expect(contentBlockCategoryLabel("other")).toBe("その他");
  });
});

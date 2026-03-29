import { describe, expect, it } from "vitest";

import {
  addTag,
  canAddTag,
  collectTagCounts,
  collectUniqueTags,
  matchesTagFilter,
  mergeUniqueTags,
  normalizeTag,
  removeTag,
  resolveActiveTagFilter,
  tagsEqual,
} from "./tags";

describe("tags", () => {
  it("normalizes, validates, adds, and removes tags", () => {
    expect(normalizeTag("  社外  ")).toBe("社外");
    expect(canAddTag(["社外"], "  社外  ")).toBe(false);
    expect(canAddTag(["社外"], "  営業  ")).toBe(true);
    expect(addTag(["社外"], "  営業  ")).toEqual(["社外", "営業"]);
    expect(removeTag(["社外", "営業"], "社外")).toEqual(["営業"]);
  });

  it("collects and merges unique tags in insertion order", () => {
    expect(
      collectUniqueTags([
        { tags: ["社外", "営業"] },
        { tags: ["営業", "採用"] },
        { tags: undefined },
      ]),
    ).toEqual(["社外", "営業", "採用"]);
    expect(
      collectTagCounts([
        { tags: ["社外", "営業"] },
        { tags: ["営業", "採用"] },
        { tags: ["社外"] },
      ]),
    ).toEqual({
      社外: 2,
      営業: 2,
      採用: 1,
    });
    expect(mergeUniqueTags(["社外", "営業"], ["営業", "採用"])).toEqual(["社外", "営業", "採用"]);
  });

  it("resolves active tag filters and compares tag lists", () => {
    expect(resolveActiveTagFilter(["社外", "営業"], "営業")).toBe("営業");
    expect(resolveActiveTagFilter(["社外", "営業"], "採用")).toBeNull();
    expect(matchesTagFilter(["社外", "営業"], "営業")).toBe(true);
    expect(matchesTagFilter(["社外", "営業"], "採用")).toBe(false);
    expect(tagsEqual(["社外", "営業"], ["社外", "営業"])).toBe(true);
    expect(tagsEqual(["社外", "営業"], ["営業", "社外"])).toBe(false);
  });
});

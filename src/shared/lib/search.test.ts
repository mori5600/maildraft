import { describe, expect, it } from "vitest";

import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchQuery,
  matchesSearchTokens,
} from "./search";

describe("search", () => {
  it("normalizes query tokens for case and full-width variants", () => {
    expect(createSearchTokens(" ＡＢＣ   Test ")).toEqual(["abc", "test"]);
  });

  it("matches tokenized queries against cached haystacks", () => {
    const haystack = buildSearchHaystack(["株式会社ABC", "担当 TEST"]);

    expect(matchesSearchTokens(["abc"], haystack)).toBe(true);
    expect(matchesSearchTokens(["abc", "test"], haystack)).toBe(true);
    expect(matchesSearchTokens(["missing"], haystack)).toBe(false);
  });

  it("preserves the public query matcher behavior", () => {
    expect(matchesSearchQuery("abc test", ["株式会社ＡＢＣ", "担当 test"])).toBe(true);
    expect(matchesSearchQuery("abc missing", ["株式会社ＡＢＣ", "担当 test"])).toBe(false);
    expect(matchesSearchQuery("", ["anything"])).toBe(true);
  });
});

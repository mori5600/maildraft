import { describe, expect, it } from "vitest";

import { buildTagSuggestionOptions } from "./tag-picker-options";

describe("tag-picker-options", () => {
  it("orders prefix matches before partial matches and excludes selected tags", () => {
    expect(buildTagSuggestionOptions(["営業", "社外営業", "会議"], ["会議"], "営", false)).toEqual([
      {
        kind: "existing",
        label: "営業",
        value: "営業",
      },
      {
        kind: "existing",
        label: "社外営業",
        value: "社外営業",
      },
    ]);
  });

  it("adds a create option only when the normalized value is still addable", () => {
    expect(buildTagSuggestionOptions(["営業"], [], "採用", true)).toContainEqual({
      kind: "create",
      label: "「採用」を追加",
      value: "採用",
    });
    expect(buildTagSuggestionOptions(["営業"], [], "営業", true)).toEqual([
      {
        kind: "existing",
        label: "営業",
        value: "営業",
      },
    ]);
  });
});

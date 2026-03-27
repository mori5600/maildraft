import { describe, expect, it } from "vitest";

import { createTemplate } from "../../../test/ui-fixtures";
import { createTemplateSearchIndex, selectFilteredTemplates } from "./template-workspace-selectors";

describe("template-workspace-selectors", () => {
  it("builds a search index that can match tag queries", () => {
    const searchIndex = createTemplateSearchIndex([
      createTemplate({
        id: "template-a",
        name: "営業お礼",
        tags: ["社外"],
      }),
      createTemplate({
        id: "template-b",
        name: "採用連絡",
        tags: ["採用"],
      }),
    ]);

    expect(
      selectFilteredTemplates(searchIndex, "採用", null, "name").map((template) => template.id),
    ).toEqual(["template-b"]);
    expect(
      selectFilteredTemplates(searchIndex, "社外", null, "name").map((template) => template.id),
    ).toEqual(["template-a"]);
  });

  it("applies tag filters and preserves template sorting", () => {
    const searchIndex = createTemplateSearchIndex([
      createTemplate({
        id: "template-b",
        name: "Beta",
        updatedAt: "10",
        tags: ["営業"],
      }),
      createTemplate({
        id: "template-a",
        isPinned: true,
        name: "Alpha",
        updatedAt: "20",
        tags: ["営業"],
      }),
      createTemplate({
        id: "template-c",
        name: "Gamma",
        updatedAt: "30",
        tags: ["採用"],
      }),
    ]);

    expect(
      selectFilteredTemplates(searchIndex, "", "営業", "name").map((template) => template.id),
    ).toEqual(["template-a", "template-b"]);
  });
});

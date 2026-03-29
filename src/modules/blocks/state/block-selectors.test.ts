import { describe, expect, it } from "vitest";

import { createContentBlock } from "../../../test/ui-fixtures";
import { filterBlocks, selectInsertableBlocks } from "./block-selectors";

describe("block selectors", () => {
  it("filters blocks by search text and active tag", () => {
    expect(
      filterBlocks(
        [
          createContentBlock({
            body: "依頼本文",
            id: "block-request",
            name: "依頼",
            tags: ["社外"],
            updatedAt: "2",
          }),
          createContentBlock({
            body: "お礼本文",
            id: "block-thanks",
            name: "お礼",
            tags: ["社内"],
            updatedAt: "1",
          }),
        ],
        "依頼",
        "社外",
      ).map((block) => block.id),
    ).toEqual(["block-request"]);
  });

  it("only exposes insertable blocks with body text", () => {
    expect(
      selectInsertableBlocks(
        [
          createContentBlock({
            body: "",
            id: "block-empty",
            name: "空",
            updatedAt: "2",
          }),
          createContentBlock({
            body: "ご確認ください。",
            id: "block-body",
            name: "依頼",
            updatedAt: "1",
          }),
        ],
        "",
      ).map((block) => block.id),
    ).toEqual(["block-body"]);
  });
});

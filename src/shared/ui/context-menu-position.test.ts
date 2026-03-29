import { describe, expect, it } from "vitest";

import { clampContextMenuPosition } from "./context-menu-position";

describe("clampContextMenuPosition", () => {
  it("keeps the menu inside the viewport padding", () => {
    expect(
      clampContextMenuPosition(
        { x: 380, y: 290 },
        { width: 120, height: 80 },
        { width: 400, height: 300 },
        8,
      ),
    ).toEqual({
      x: 272,
      y: 212,
    });
  });
});

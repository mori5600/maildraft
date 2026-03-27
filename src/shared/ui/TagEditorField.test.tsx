import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagEditorField } from "./TagEditorField";

describe("TagEditorField", () => {
  it("adds an existing tag from suggestions", async () => {
    const user = userEvent.setup();
    const handleChangeTags = vi.fn();

    render(
      <TagEditorField
        availableTags={["社外", "お礼", "会議"]}
        tags={["お礼"]}
        onChangeTags={handleChangeTags}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "タグ" }));
    await user.click(screen.getByRole("option", { name: /社外/ }));

    expect(handleChangeTags).toHaveBeenCalledWith(["お礼", "社外"]);
  });

  it("creates a new tag with Enter and removes the last tag with Backspace", async () => {
    const user = userEvent.setup();
    const handleChangeTags = vi.fn();

    render(
      <TagEditorField
        availableTags={["社外", "お礼"]}
        tags={["社外"]}
        onChangeTags={handleChangeTags}
      />,
    );

    const input = screen.getByRole("combobox", { name: "タグ" });
    await user.type(input, "採用{Enter}");
    expect(handleChangeTags).toHaveBeenCalledWith(["社外", "採用"]);

    await user.clear(input);
    await user.keyboard("{Backspace}");
    expect(handleChangeTags).toHaveBeenCalledWith([]);
  });
});

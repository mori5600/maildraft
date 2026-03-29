import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagFilterBar } from "./TagFilterBar";

describe("TagFilterBar", () => {
  it("renders tag counts and toggles the active tag", async () => {
    const user = userEvent.setup();
    const handleChangeTag = vi.fn();

    render(
      <TagFilterBar
        activeTag="社外"
        availableTags={["社外", "営業"]}
        tagCounts={{ 社外: 2, 営業: 1 }}
        onChangeTag={handleChangeTag}
      />,
    );

    expect(screen.getByRole("button", { name: /社外.*2/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /営業.*1/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /社外.*2/ }));
    expect(handleChangeTag).toHaveBeenCalledWith(null);
  });
});

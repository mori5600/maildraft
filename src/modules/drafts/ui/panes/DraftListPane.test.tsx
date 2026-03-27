import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDraft } from "../../../../test/ui-fixtures";
import { DraftListPane } from "./DraftListPane";

describe("DraftListPane", () => {
  it("handles draft list interactions", async () => {
    const user = userEvent.setup();
    const handleSelectDraft = vi.fn();
    const handleCreateDraft = vi.fn();
    const handleChangeSearchQuery = vi.fn();
    const handleChangeSort = vi.fn();
    const handleChangeTagFilter = vi.fn();

    render(
      <DraftListPane
        activeTagFilter={null}
        availableTags={["社外", "営業"]}
        drafts={[createDraft({ isPinned: true, tags: ["社外", "営業"] })]}
        searchQuery="礼"
        selectedDraftId="draft-1"
        sort="recent"
        totalDraftCount={3}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
        onChangeTagFilter={handleChangeTagFilter}
        onCreateDraft={handleCreateDraft}
        onSelectDraft={handleSelectDraft}
      />,
    );

    expect(screen.getByText("1 / 3件")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/Cmd+K")).toBeInTheDocument();
    expect(screen.getByTitle("固定")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新規" }));
    expect(handleCreateDraft).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "消去" }));
    expect(handleChangeSearchQuery).toHaveBeenCalledWith("");

    await user.selectOptions(screen.getByRole("combobox"), "label");
    expect(handleChangeSort).toHaveBeenCalledWith("label");

    await user.click(screen.getByRole("button", { name: "社外" }));
    expect(handleChangeTagFilter).toHaveBeenCalledWith("社外");

    expect(screen.getAllByText("社外")).toHaveLength(2);
    expect(screen.getAllByText("営業")).toHaveLength(2);

    await user.click(screen.getByText("4/12 打ち合わせお礼").closest("button") ?? document.body);
    expect(handleSelectDraft).toHaveBeenCalledWith("draft-1");
  });
});

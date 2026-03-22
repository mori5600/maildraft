import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDraftHistoryEntry, createSignature } from "../../../test/ui-fixtures";
import { DraftHistoryOverlay } from "./DraftHistoryOverlay";

describe("DraftHistoryOverlay", () => {
  it("renders history entries and restores the selected entry", async () => {
    const user = userEvent.setup();
    const handleRestore = vi.fn(async () => {});

    render(
      <DraftHistoryOverlay
        historyEntries={[createDraftHistoryEntry()]}
        isOpen
        showWhitespace={false}
        signatures={[createSignature()]}
        onClose={vi.fn()}
        onRestore={handleRestore}
      />,
    );

    expect(screen.getByText("1件の履歴")).toBeInTheDocument();
    expect(screen.getAllByText("件名").length).toBeGreaterThan(0);
    expect(screen.getAllByText("本文").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "復元" }));
    expect(handleRestore).toHaveBeenCalledWith("history-1");
  });
});

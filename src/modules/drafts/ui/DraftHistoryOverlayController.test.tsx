import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDraftHistoryEntry, createSignature } from "../../../test/ui-fixtures";
import { DraftHistoryOverlayController } from "./DraftHistoryOverlayController";

describe("DraftHistoryOverlayController", () => {
  it("closes the overlay after restoring history", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleRestoreDraftHistory = vi.fn(async () => {});

    render(
      <DraftHistoryOverlayController
        historyEntries={[createDraftHistoryEntry()]}
        isOpen
        showWhitespace={false}
        signatures={[createSignature()]}
        onClose={handleClose}
        onRestoreDraftHistory={handleRestoreDraftHistory}
      />,
    );

    await user.click(screen.getByRole("button", { name: "復元" }));

    await waitFor(() => {
      expect(handleRestoreDraftHistory).toHaveBeenCalledWith("history-1");
      expect(handleClose).toHaveBeenCalled();
    });
  });
});

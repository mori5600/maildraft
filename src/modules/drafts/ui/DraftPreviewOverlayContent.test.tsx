import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createIssue } from "./draft-ui-test-helpers";
import { DraftPreviewOverlayContent } from "./DraftPreviewOverlayContent";

describe("DraftPreviewOverlayContent", () => {
  it("renders preview dialog content inside the overlay and wires actions", async () => {
    const user = userEvent.setup();
    const handleCopyPreview = vi.fn(async () => {});
    const handleRunDetailedCheck = vi.fn();

    render(
      <DraftPreviewOverlayContent
        canCopyPreview
        detailedCheckStatus="ready"
        detailedCheckStatusLabel="textlint と prh の詳細チェック結果を反映しています。"
        isOpen
        issues={[createIssue()]}
        previewBodyText="本文"
        previewDescription="営業署名"
        previewSubject="件名"
        selectedIssueId={null}
        onApplyIssueSuggestion={vi.fn()}
        onClose={vi.fn()}
        onCopyPreview={handleCopyPreview}
        onDisableIssueRule={vi.fn()}
        onIgnoreIssue={vi.fn()}
        onRunDetailedCheck={handleRunDetailedCheck}
        onSelectIssue={vi.fn()}
      />,
    );

    expect(screen.getByText("下書きプレビュー")).toBeInTheDocument();
    expect(screen.getAllByText("件名").length).toBeGreaterThan(0);
    expect(screen.getAllByText("本文").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(handleCopyPreview).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "詳細チェック" }));
    expect(handleRunDetailedCheck).toHaveBeenCalled();
  });
});

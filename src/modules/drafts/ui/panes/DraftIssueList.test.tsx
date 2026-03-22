import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createIssue } from "../draft-ui-test-helpers";
import { DraftIssueList } from "./DraftIssueList";

describe("DraftIssueList", () => {
  it("renders draft issues and their actions", async () => {
    const user = userEvent.setup();
    const handleApplyIssueSuggestion = vi.fn();
    const handleDisableIssueRule = vi.fn();
    const handleIgnoreIssue = vi.fn();
    const handleSelectIssue = vi.fn();

    render(
      <DraftIssueList
        issues={[createIssue()]}
        selectedIssueId={null}
        onApplyIssueSuggestion={handleApplyIssueSuggestion}
        onDisableIssueRule={handleDisableIssueRule}
        onIgnoreIssue={handleIgnoreIssue}
        onSelectIssue={handleSelectIssue}
      />,
    );

    expect(screen.getByText("非推奨表現の可能性があります。")).toBeInTheDocument();
    expect(screen.getByText("warning")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /非推奨表現の可能性があります/ }));
    expect(handleSelectIssue).toHaveBeenCalledWith("issue-1");

    await user.click(screen.getByRole("button", { name: "言い換える" }));
    expect(handleApplyIssueSuggestion).toHaveBeenCalledWith("issue-1");

    await user.click(screen.getByRole("button", { name: "ルールを無効化" }));
    expect(handleDisableIssueRule).toHaveBeenCalledWith("discouraged.understood");

    await user.click(screen.getByRole("button", { name: "今回のみ無視" }));
    expect(handleIgnoreIssue).toHaveBeenCalledWith("issue-1");
  });
});

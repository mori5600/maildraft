import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createContentBlock,
  createDraft,
  createDraftHistoryEntry,
  createDraftInput,
  createSignature,
  createTemplate,
  createVariablePreset,
} from "../../../test/ui-fixtures";
import { DraftWorkspace } from "./DraftWorkspace";

describe("DraftWorkspace", () => {
  it("connects draft workspace overlays and panes", async () => {
    const user = userEvent.setup();
    const handleRestoreDraftHistory = vi.fn(async () => {});

    render(
      <DraftWorkspace
        activeTagFilter={null}
        autoSaveLabel="自動保存済み"
        availableTags={["社外"]}
        blocks={[createContentBlock()]}
        canApplyVariablePreset
        canCreateTemplate
        canDuplicate
        canSaveVariablePreset
        detailedCheckStatus="ready"
        detailedCheckStatusLabel="textlint と prh の詳細チェック結果を反映しています。"
        draftForm={createDraftInput()}
        draftHistory={[createDraftHistoryEntry()]}
        drafts={[createDraft()]}
        issues={[
          {
            description: "説明",
            excerpt: "了解しました",
            field: "body",
            id: "issue-1",
            ruleId: "discouraged.understood",
            severity: "warning",
            suggestion: {
              edits: [],
              label: "言い換える",
            },
            title: "非推奨表現の可能性があります。",
          },
        ]}
        previewSubject="件名"
        previewText="本文"
        searchQuery=""
        selectedDraftId="draft-1"
        selectedVariablePresetId="preset-1"
        showWhitespace={false}
        signatures={[createSignature()]}
        sort="recent"
        templates={[createTemplate()]}
        totalDraftCount={1}
        variableNames={["相手名"]}
        variablePresetName="A社向け"
        variablePresets={[createVariablePreset()]}
        onApplyIssueSuggestion={vi.fn()}
        onApplyTemplate={vi.fn()}
        onApplyVariablePreset={vi.fn(async () => {})}
        onApplyRecommendedVariablePreset={vi.fn(async () => {})}
        onChangeDraft={vi.fn()}
        onChangeDraftVariable={vi.fn()}
        onChangeSearchQuery={vi.fn()}
        onChangeSort={vi.fn()}
        onChangeTagFilter={vi.fn()}
        onChangeVariablePresetName={vi.fn()}
        onCopyPreview={vi.fn(async () => {})}
        onCreateDraft={vi.fn()}
        onCreateTemplateFromDraft={vi.fn()}
        onCreateVariablePreset={vi.fn()}
        onDeleteDraft={vi.fn(async () => {})}
        onDeleteVariablePreset={vi.fn(async () => {})}
        onDisableIssueRule={vi.fn()}
        onDuplicateDraft={vi.fn(async () => {})}
        onInsertBlock={vi.fn()}
        onIgnoreIssue={vi.fn()}
        onRunDetailedCheck={vi.fn()}
        onRestoreDraftHistory={handleRestoreDraftHistory}
        onSaveDraft={vi.fn(async () => {})}
        onSaveVariablePreset={vi.fn(async () => {})}
        onSelectDraft={vi.fn()}
        onSelectVariablePreset={vi.fn()}
        onTogglePinned={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByText("下書きプレビュー")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await user.click(screen.getByRole("button", { name: "履歴" }));
    expect(screen.getByText("1件の履歴")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "復元" })[0]);
    expect(handleRestoreDraftHistory).toHaveBeenCalledWith("history-1");
  }, 10000);
});

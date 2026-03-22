import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDraftInput, createVariablePreset } from "../../../../test/ui-fixtures";
import { createIssue } from "../draft-ui-test-helpers";
import { DraftPreviewPane } from "./DraftPreviewPane";

describe("DraftPreviewPane", () => {
  it("handles draft preview pane actions", async () => {
    const user = userEvent.setup();
    const handleOpenHistory = vi.fn();
    const handleOpenPreview = vi.fn();
    const handleCopyPreview = vi.fn(async () => {});
    const handleApplyIssueSuggestion = vi.fn();
    const handleChangeDraftVariable = vi.fn();
    const handleSelectVariablePreset = vi.fn();
    const handleChangeVariablePresetName = vi.fn();
    const handleCreateVariablePreset = vi.fn();
    const handleApplyVariablePreset = vi.fn();
    const handleDisableIssueRule = vi.fn();
    const handleIgnoreIssue = vi.fn();
    const handleRunDetailedCheck = vi.fn();
    const handleSelectIssue = vi.fn();
    const handleSaveVariablePreset = vi.fn(async () => {});
    const handleDeleteVariablePreset = vi.fn(async () => {});

    render(
      <DraftPreviewPane
        canApplyVariablePreset
        canCopyPreview
        canExpandPreview
        canSaveVariablePreset
        detailedCheckStatus="ready"
        detailedCheckStatusLabel="textlint と prh の詳細チェック結果を反映しています。"
        draftForm={createDraftInput()}
        draftHistoryCount={1}
        issues={[createIssue()]}
        previewBodyText="本文プレビュー"
        previewDescription="営業署名"
        previewSubject="件名"
        selectedIssueId="issue-1"
        selectedVariablePresetId="preset-1"
        showWhitespace={false}
        variableNames={["相手名"]}
        variablePresetName="A社向け"
        variablePresets={[createVariablePreset()]}
        onApplyIssueSuggestion={handleApplyIssueSuggestion}
        onApplyVariablePreset={handleApplyVariablePreset}
        onChangeDraftVariable={handleChangeDraftVariable}
        onChangeVariablePresetName={handleChangeVariablePresetName}
        onCopyPreview={handleCopyPreview}
        onCreateVariablePreset={handleCreateVariablePreset}
        onDeleteVariablePreset={handleDeleteVariablePreset}
        onDisableIssueRule={handleDisableIssueRule}
        onIgnoreIssue={handleIgnoreIssue}
        onOpenHistory={handleOpenHistory}
        onOpenPreview={handleOpenPreview}
        onRunDetailedCheck={handleRunDetailedCheck}
        onSaveVariablePreset={handleSaveVariablePreset}
        onSelectIssue={handleSelectIssue}
        onSelectVariablePreset={handleSelectVariablePreset}
      />,
    );

    await user.click(screen.getByRole("button", { name: "履歴" }));
    expect(handleOpenHistory).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(handleOpenPreview).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(handleCopyPreview).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "詳細チェック" }));
    expect(handleRunDetailedCheck).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "言い換える" }));
    expect(handleApplyIssueSuggestion).toHaveBeenCalledWith("issue-1");
    expect(screen.getByRole("button", { name: /非推奨表現の可能性があります/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /非推奨表現の可能性があります/ }));
    expect(handleSelectIssue).toHaveBeenCalledWith("issue-1");
    await user.click(screen.getByRole("button", { name: "ルールを無効化" }));
    expect(handleDisableIssueRule).toHaveBeenCalledWith("discouraged.understood");
    await user.click(screen.getByRole("button", { name: "今回のみ無視" }));
    expect(handleIgnoreIssue).toHaveBeenCalledWith("issue-1");
    await user.click(screen.getByRole("button", { name: "適用" }));
    expect(handleApplyVariablePreset).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "新規セット" }));
    expect(handleCreateVariablePreset).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "値を保存" }));
    expect(handleSaveVariablePreset).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(handleDeleteVariablePreset).toHaveBeenCalled();
    await user.type(screen.getByLabelText("セット名"), "更新");
    expect(handleChangeVariablePresetName).toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText("{{相手名}} に入れる値"), "追記");
    expect(handleChangeDraftVariable).toHaveBeenCalled();
  });

  it("shows whitespace markers in draft variable inputs without changing their values", () => {
    render(
      <DraftPreviewPane
        canApplyVariablePreset
        canCopyPreview
        canExpandPreview
        canSaveVariablePreset
        detailedCheckStatus="pending"
        detailedCheckStatusLabel="入力停止後に詳細チェックを実行します。"
        draftForm={createDraftInput({ variableValues: { 相手名: "田 中" } })}
        draftHistoryCount={1}
        issues={[]}
        previewBodyText="本文プレビュー"
        previewDescription="営業署名"
        previewSubject="件名"
        selectedIssueId={null}
        selectedVariablePresetId="preset-1"
        showWhitespace
        variableNames={["相手名"]}
        variablePresetName="A 社向け"
        variablePresets={[createVariablePreset()]}
        onApplyIssueSuggestion={vi.fn()}
        onApplyVariablePreset={vi.fn()}
        onChangeDraftVariable={vi.fn()}
        onChangeVariablePresetName={vi.fn()}
        onCopyPreview={vi.fn(async () => {})}
        onCreateVariablePreset={vi.fn()}
        onDeleteVariablePreset={vi.fn(async () => {})}
        onDisableIssueRule={vi.fn()}
        onIgnoreIssue={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenPreview={vi.fn()}
        onRunDetailedCheck={vi.fn()}
        onSaveVariablePreset={vi.fn(async () => {})}
        onSelectIssue={vi.fn()}
        onSelectVariablePreset={vi.fn()}
      />,
    );

    expect(screen.getByText("A·社向け")).toBeInTheDocument();
    expect(screen.getByText("田·中")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A 社向け")).toBeInTheDocument();
    expect(screen.getByDisplayValue("田 中")).toBeInTheDocument();
  });
});

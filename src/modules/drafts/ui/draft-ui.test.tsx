import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createDraft,
  createDraftHistoryEntry,
  createDraftInput,
  createSignature,
  createTemplate,
  createVariablePreset,
} from "../../../test/ui-fixtures";
import { DraftHistoryOverlay } from "./DraftHistoryOverlay";
import { DraftWorkspace } from "./DraftWorkspace";
import { DraftEditorPane } from "./panes/DraftEditorPane";
import { DraftIssueList } from "./panes/DraftIssueList";
import { DraftListPane } from "./panes/DraftListPane";
import { DraftPreviewDialogContent } from "./panes/DraftPreviewDialogContent";
import { DraftPreviewPane } from "./panes/DraftPreviewPane";

function createIssue() {
  return {
    description: "説明",
    excerpt: "了解しました",
    field: "body" as const,
    id: "issue-1",
    ruleId: "discouraged.understood",
    severity: "warning" as const,
    suggestion: {
      edits: [],
      label: "言い換える",
    },
    title: "非推奨表現の可能性があります。",
  };
}

describe("draft UI", () => {
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

  it("handles draft list interactions", async () => {
    const user = userEvent.setup();
    const handleSelectDraft = vi.fn();
    const handleCreateDraft = vi.fn();
    const handleChangeSearchQuery = vi.fn();
    const handleChangeSort = vi.fn();
    render(
      <DraftListPane
        drafts={[createDraft({ isPinned: true })]}
        searchQuery="礼"
        selectedDraftId="draft-1"
        sort="recent"
        totalDraftCount={3}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
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
    await user.click(screen.getByText("4/12 打ち合わせお礼").closest("button") ?? document.body);
    expect(handleSelectDraft).toHaveBeenCalledWith("draft-1");
  });

  it("handles draft editor interactions", async () => {
    const user = userEvent.setup();
    const handleChangeDraft = vi.fn();
    const handleDeleteDraft = vi.fn(async () => {});
    const handleDuplicateDraft = vi.fn(async () => {});
    const handleSaveDraft = vi.fn(async () => {});
    const handleTogglePinned = vi.fn();
    const handleApplyTemplate = vi.fn();
    render(
      <DraftEditorPane
        activeIssue={null}
        activeIssueRequestKey={0}
        autoSaveLabel="自動保存済み"
        canDuplicate
        draftForm={createDraftInput()}
        selectedDraftId="draft-input-1"
        showWhitespace={false}
        signatures={[createSignature()]}
        templates={[createTemplate()]}
        onApplyTemplate={handleApplyTemplate}
        onChangeDraft={handleChangeDraft}
        onDeleteDraft={handleDeleteDraft}
        onDuplicateDraft={handleDuplicateDraft}
        onSaveDraft={handleSaveDraft}
        onTogglePinned={handleTogglePinned}
      />,
    );

    const titleEditor = screen.getByRole("textbox", { name: "一覧名" });
    await user.click(titleEditor);
    await user.keyboard("{End}追記");
    expect(handleChangeDraft).toHaveBeenCalledWith("title", expect.stringContaining("追記"));
    await user.click(screen.getByRole("textbox", { name: "宛名メモ" }));
    await user.keyboard("追記");
    expect(handleChangeDraft).toHaveBeenCalledWith("recipient", expect.stringContaining("追記"));
    const bodyEditor = screen.getByRole("textbox", { name: "本文" });
    await user.click(bodyEditor);
    await user.keyboard("{Enter}追記");
    expect(bodyEditor).toHaveFocus();
    expect(handleChangeDraft).toHaveBeenCalledWith("body", expect.stringContaining("追記"));
    await user.selectOptions(screen.getAllByRole("combobox")[0], "template-1");
    expect(handleApplyTemplate).toHaveBeenCalledWith("template-1");
    await user.click(screen.getByRole("button", { name: "固定" }));
    expect(handleTogglePinned).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(handleDuplicateDraft).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveDraft).toHaveBeenCalled();
  }, 20000);

  it("keeps multiline draft fields in CodeMirror when whitespace is visible", () => {
    render(
      <DraftEditorPane
        activeIssue={null}
        activeIssueRequestKey={0}
        autoSaveLabel="自動保存済み"
        canDuplicate
        draftForm={createDraftInput()}
        selectedDraftId="draft-input-1"
        showWhitespace
        signatures={[createSignature()]}
        templates={[createTemplate()]}
        onApplyTemplate={vi.fn()}
        onChangeDraft={vi.fn()}
        onDeleteDraft={vi.fn(async () => {})}
        onDuplicateDraft={vi.fn(async () => {})}
        onSaveDraft={vi.fn(async () => {})}
        onTogglePinned={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "一覧名" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "件名" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "宛名メモ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "書き出し" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "本文" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "結び" })).toBeInTheDocument();
  });

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

  it("renders preview dialog content and history overlay", async () => {
    const user = userEvent.setup();
    const handleRestore = vi.fn(async () => {});
    render(
      <>
        <DraftPreviewDialogContent
          detailedCheckStatus="ready"
          detailedCheckStatusLabel="textlint と prh の詳細チェック結果を反映しています。"
          issues={[createIssue()]}
          previewBodyText="本文"
          previewSubject="件名"
          selectedIssueId={null}
          onApplyIssueSuggestion={vi.fn()}
          onDisableIssueRule={vi.fn()}
          onIgnoreIssue={vi.fn()}
          onRunDetailedCheck={vi.fn()}
          onSelectIssue={vi.fn()}
        />
        <DraftHistoryOverlay
          historyEntries={[createDraftHistoryEntry()]}
          isOpen
          showWhitespace={false}
          signatures={[createSignature()]}
          onClose={vi.fn()}
          onRestore={handleRestore}
        />
      </>,
    );

    expect(screen.getAllByText("件名").length).toBeGreaterThan(0);
    expect(screen.getAllByText("本文").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "復元" }));
    expect(handleRestore).toHaveBeenCalledWith("history-1");
  });

  it("connects draft workspace overlays and panes", async () => {
    const user = userEvent.setup();
    const handleRestoreDraftHistory = vi.fn(async () => {});
    render(
      <DraftWorkspace
        autoSaveLabel="自動保存済み"
        canApplyVariablePreset
        canDuplicate
        canSaveVariablePreset
        detailedCheckStatus="ready"
        detailedCheckStatusLabel="textlint と prh の詳細チェック結果を反映しています。"
        draftForm={createDraftInput()}
        draftHistory={[createDraftHistoryEntry()]}
        drafts={[createDraft()]}
        issues={[createIssue()]}
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
        onApplyVariablePreset={vi.fn()}
        onChangeDraft={vi.fn()}
        onChangeDraftVariable={vi.fn()}
        onChangeSearchQuery={vi.fn()}
        onChangeSort={vi.fn()}
        onChangeVariablePresetName={vi.fn()}
        onCopyPreview={vi.fn(async () => {})}
        onCreateDraft={vi.fn()}
        onCreateVariablePreset={vi.fn()}
        onDeleteDraft={vi.fn(async () => {})}
        onDeleteVariablePreset={vi.fn(async () => {})}
        onDuplicateDraft={vi.fn(async () => {})}
        onDisableIssueRule={vi.fn()}
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

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
import { DraftCheckList } from "./panes/DraftCheckList";
import { DraftEditorPane } from "./panes/DraftEditorPane";
import { DraftListPane } from "./panes/DraftListPane";
import { DraftPreviewDialogContent } from "./panes/DraftPreviewDialogContent";
import { DraftPreviewPane } from "./panes/DraftPreviewPane";

describe("draft UI", () => {
  it("renders draft checklist states", () => {
    render(<DraftCheckList checks={["確認は通っています", "件名が空です"]} />);

    expect(screen.getByText("確認は通っています")).toBeInTheDocument();
    expect(screen.getByText("件名が空です")).toBeInTheDocument();
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

    await user.type(screen.getByDisplayValue("4/12 打ち合わせお礼"), "追記");
    expect(handleChangeDraft).toHaveBeenCalled();
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
  });

  it("keeps the draft body in CodeMirror when whitespace is visible", () => {
    render(
      <DraftEditorPane
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

    expect(screen.getByRole("textbox", { name: "本文" })).toBeInTheDocument();
  });

  it("handles draft preview pane actions", async () => {
    const user = userEvent.setup();
    const handleOpenHistory = vi.fn();
    const handleOpenPreview = vi.fn();
    const handleCopyPreview = vi.fn(async () => {});
    const handleChangeDraftVariable = vi.fn();
    const handleSelectVariablePreset = vi.fn();
    const handleChangeVariablePresetName = vi.fn();
    const handleCreateVariablePreset = vi.fn();
    const handleApplyVariablePreset = vi.fn();
    const handleSaveVariablePreset = vi.fn(async () => {});
    const handleDeleteVariablePreset = vi.fn(async () => {});

    render(
      <DraftPreviewPane
        canApplyVariablePreset
        canCopyPreview
        canExpandPreview
        canSaveVariablePreset
        checks={["件名が空です"]}
        draftForm={createDraftInput()}
        draftHistoryCount={1}
        previewBodyText="本文プレビュー"
        previewDescription="営業署名"
        previewSubject="件名"
        selectedVariablePresetId="preset-1"
        showWhitespace={false}
        variableNames={["相手名"]}
        variablePresetName="A社向け"
        variablePresets={[createVariablePreset()]}
        onApplyVariablePreset={handleApplyVariablePreset}
        onChangeDraftVariable={handleChangeDraftVariable}
        onChangeVariablePresetName={handleChangeVariablePresetName}
        onCopyPreview={handleCopyPreview}
        onCreateVariablePreset={handleCreateVariablePreset}
        onDeleteVariablePreset={handleDeleteVariablePreset}
        onOpenHistory={handleOpenHistory}
        onOpenPreview={handleOpenPreview}
        onSaveVariablePreset={handleSaveVariablePreset}
        onSelectVariablePreset={handleSelectVariablePreset}
      />,
    );

    await user.click(screen.getByRole("button", { name: "履歴" }));
    expect(handleOpenHistory).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(handleOpenPreview).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(handleCopyPreview).toHaveBeenCalled();
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

  it("renders preview dialog content and history overlay", async () => {
    const user = userEvent.setup();
    const handleRestore = vi.fn(async () => {});
    render(
      <>
        <DraftPreviewDialogContent checks={["確認"]} previewBodyText="本文" previewSubject="件名" />
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
        checks={["件名が空です"]}
        draftForm={createDraftInput()}
        draftHistory={[createDraftHistoryEntry()]}
        drafts={[createDraft()]}
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
  });
});

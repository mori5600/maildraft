import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createSignature,
  createTemplate,
  createTemplateInput,
} from "../../../test/ui-fixtures";
import { TemplateEditorPane } from "./panes/TemplateEditorPane";
import { TemplateListPane } from "./panes/TemplateListPane";
import { TemplatePreviewDialogContent } from "./panes/TemplatePreviewDialogContent";
import { TemplatePreviewPane } from "./panes/TemplatePreviewPane";
import { TemplateWorkspace } from "./TemplateWorkspace";

describe("template UI", () => {
  it("handles template list interactions", async () => {
    const user = userEvent.setup();
    const handleSelectTemplate = vi.fn();
    const handleCreateTemplate = vi.fn();
    const handleChangeSearchQuery = vi.fn();
    const handleChangeSort = vi.fn();

    render(
      <TemplateListPane
        searchQuery="礼"
        selectedTemplateId="template-1"
        sort="recent"
        templates={[createTemplate()]}
        totalTemplateCount={4}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
        onCreateTemplate={handleCreateTemplate}
        onSelectTemplate={handleSelectTemplate}
      />,
    );

    expect(screen.getByText("1 / 4件")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "新規" }));
    expect(handleCreateTemplate).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "消去" }));
    expect(handleChangeSearchQuery).toHaveBeenCalledWith("");
    await user.selectOptions(screen.getByRole("combobox"), "name");
    expect(handleChangeSort).toHaveBeenCalledWith("name");
    await user.click(screen.getByText("打ち合わせお礼").closest("button") ?? document.body);
    expect(handleSelectTemplate).toHaveBeenCalledWith("template-1");
  });

  it("handles template editor and preview actions", async () => {
    const user = userEvent.setup();
    const handleChangeTemplate = vi.fn();
    const handleSaveTemplate = vi.fn(async () => {});
    const handleDeleteTemplate = vi.fn(async () => {});
    const handleDuplicateTemplate = vi.fn(async () => {});
    const handleTogglePinned = vi.fn();
    const handleStartDraftFromTemplate = vi.fn();

    render(
      <>
        <TemplateEditorPane
          canDuplicate
          selectedTemplateId="template-input-1"
          showWhitespace={false}
          signatures={[createSignature()]}
          templateForm={createTemplateInput()}
          onChangeTemplate={handleChangeTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onDuplicateTemplate={handleDuplicateTemplate}
          onSaveTemplate={handleSaveTemplate}
          onTogglePinned={handleTogglePinned}
        />
        <TemplatePreviewPane
          canExpandPreview
          previewBodyText="テンプレート本文"
          templateForm={createTemplateInput()}
          onOpenPreview={vi.fn()}
          onStartDraftFromTemplate={handleStartDraftFromTemplate}
        />
        <TemplatePreviewDialogContent previewBodyText="本文" subject="件名" />
      </>,
    );

    await user.type(screen.getByDisplayValue("打ち合わせお礼"), "更新");
    expect(handleChangeTemplate).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "固定" }));
    expect(handleTogglePinned).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(handleDuplicateTemplate).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveTemplate).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "下書きを作成" }));
    expect(handleStartDraftFromTemplate).toHaveBeenCalled();
    expect(screen.getAllByText("件名").length).toBeGreaterThan(0);
  });

  it("connects template workspace overlay", async () => {
    const user = userEvent.setup();

    render(
      <TemplateWorkspace
        canDuplicate
        previewText="テンプレート本文"
        searchQuery=""
        selectedTemplateId="template-1"
        showWhitespace={false}
        signatures={[createSignature()]}
        sort="recent"
        templateForm={createTemplateInput()}
        templates={[createTemplate()]}
        totalTemplateCount={1}
        onChangeSearchQuery={vi.fn()}
        onChangeSort={vi.fn()}
        onChangeTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
        onDeleteTemplate={vi.fn(async () => {})}
        onDuplicateTemplate={vi.fn(async () => {})}
        onSaveTemplate={vi.fn(async () => {})}
        onSelectTemplate={vi.fn()}
        onStartDraftFromTemplate={vi.fn()}
        onTogglePinned={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByText("テンプレートプレビュー")).toBeInTheDocument();
  });
});

import { EditorView } from "@codemirror/view";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createSignature, createTemplate, createTemplateInput } from "../../../test/ui-fixtures";
import { TemplateEditorPane } from "./panes/TemplateEditorPane";
import { TemplateListPane } from "./panes/TemplateListPane";
import { TemplatePreviewDialogContent } from "./panes/TemplatePreviewDialogContent";
import { TemplatePreviewPane } from "./panes/TemplatePreviewPane";
import { TemplateWorkspace } from "./TemplateWorkspace";

function getEditorView(label: string): EditorView {
  const textbox = screen.getByRole("textbox", { name: label });
  const editorRoot = textbox.closest(".cm-editor");

  if (!editorRoot) {
    throw new Error("CodeMirror root not found");
  }

  const view = EditorView.findFromDOM(editorRoot as HTMLElement);
  if (!view) {
    throw new Error("CodeMirror view not found");
  }

  return view;
}

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
        templates={[createTemplate({ isPinned: true })]}
        totalTemplateCount={4}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
        onCreateTemplate={handleCreateTemplate}
        onSelectTemplate={handleSelectTemplate}
      />,
    );

    expect(screen.getByText("1 / 4件")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/Cmd+K")).toBeInTheDocument();
    expect(screen.getByTitle("固定")).toBeInTheDocument();
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
          autoSaveLabel="自動保存済み"
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

    const nameEditor = getEditorView("名前");
    nameEditor.dispatch({
      changes: {
        from: nameEditor.state.doc.length,
        insert: "更新",
      },
    });
    expect(handleChangeTemplate).toHaveBeenCalledWith("name", expect.stringContaining("更新"));
    await user.click(screen.getByRole("textbox", { name: "宛名メモ" }));
    await user.keyboard("追記");
    expect(handleChangeTemplate).toHaveBeenCalledWith("recipient", expect.stringContaining("追記"));
    const bodyEditor = screen.getByRole("textbox", { name: "本文" });
    await user.click(bodyEditor);
    await user.keyboard("{Enter}追記");
    expect(bodyEditor).toHaveFocus();
    expect(handleChangeTemplate).toHaveBeenCalledWith("body", expect.stringContaining("追記"));
    await user.click(screen.getByRole("button", { name: "固定" }));
    expect(handleTogglePinned).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(handleDuplicateTemplate).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveTemplate).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "下書きを作成" }));
    expect(handleStartDraftFromTemplate).toHaveBeenCalled();
    expect(screen.getAllByText("件名").length).toBeGreaterThan(0);
  }, 10000);

  it("keeps multiline template fields in CodeMirror when whitespace is visible", () => {
    render(
      <TemplateEditorPane
        autoSaveLabel="自動保存済み"
        canDuplicate
        selectedTemplateId="template-input-1"
        showWhitespace
        signatures={[createSignature()]}
        templateForm={createTemplateInput()}
        onChangeTemplate={vi.fn()}
        onDeleteTemplate={vi.fn(async () => {})}
        onDuplicateTemplate={vi.fn(async () => {})}
        onSaveTemplate={vi.fn(async () => {})}
        onTogglePinned={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "名前" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "件名" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "宛名メモ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "書き出し" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "本文" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "結び" })).toBeInTheDocument();
  });

  it("connects template workspace overlay", async () => {
    const user = userEvent.setup();

    render(
      <TemplateWorkspace
        autoSaveLabel="自動保存済み"
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

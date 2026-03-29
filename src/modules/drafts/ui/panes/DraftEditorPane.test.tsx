import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createContentBlock,
  createDraftInput,
  createSignature,
  createTemplate,
} from "../../../../test/ui-fixtures";
import { DraftEditorPane } from "./DraftEditorPane";

describe("DraftEditorPane", () => {
  it("handles draft editor interactions", async () => {
    const user = userEvent.setup();
    const handleChangeDraft = vi.fn();
    const handleDeleteDraft = vi.fn(async () => {});
    const handleDuplicateDraft = vi.fn(async () => {});
    const handleInsertBlock = vi.fn();
    const handleSaveDraft = vi.fn(async () => {});
    const handleTogglePinned = vi.fn();
    const handleApplyTemplate = vi.fn();
    const handleCreateTemplateFromDraft = vi.fn();

    render(
      <DraftEditorPane
        availableTags={["既存", "社外", "営業"]}
        activeIssue={null}
        activeIssueRequestKey={0}
        autoSaveLabel="自動保存済み"
        blocks={[
          createContentBlock({
            id: "block-greeting",
            body: "いつもお世話になっております。",
            category: "greeting",
            name: "挨拶",
          }),
          createContentBlock({
            id: "block-request",
            body: "ご確認をお願いいたします。",
            category: "request",
            name: "依頼",
            tags: ["社外"],
          }),
        ]}
        canCreateTemplate
        canDuplicate
        draftForm={createDraftInput({ tags: ["既存"] })}
        selectedDraftId="draft-input-1"
        showWhitespace={false}
        signatures={[createSignature()]}
        templates={[createTemplate()]}
        onApplyTemplate={handleApplyTemplate}
        onChangeDraft={handleChangeDraft}
        onCreateTemplateFromDraft={handleCreateTemplateFromDraft}
        onDeleteDraft={handleDeleteDraft}
        onDuplicateDraft={handleDuplicateDraft}
        onInsertBlock={handleInsertBlock}
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

    await user.type(screen.getByRole("combobox", { name: "タグ" }), "社外{Enter}");
    expect(handleChangeDraft).toHaveBeenCalledWith("tags", ["既存", "社外"]);

    await user.click(screen.getByRole("button", { name: "タグ「既存」を削除" }));
    expect(handleChangeDraft).toHaveBeenCalledWith("tags", []);

    await user.click(screen.getByRole("button", { name: "固定" }));
    expect(handleTogglePinned).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "テンプレート化" }));
    expect(handleCreateTemplateFromDraft).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "本文に文面ブロックを挿入" }));
    expect(screen.getByText("文面ブロックを挿入")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "文面ブロックを検索" }), "依頼");
    await user.click(screen.getByRole("button", { name: /依頼/ }));
    expect(handleInsertBlock).toHaveBeenCalledWith("body", "block-request");

    await user.click(screen.getByRole("button", { name: "複製" }));
    expect(handleDuplicateDraft).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveDraft).toHaveBeenCalled();
  }, 20000);

  it("keeps multiline draft fields in CodeMirror when whitespace is visible", () => {
    render(
      <DraftEditorPane
        availableTags={["社外"]}
        activeIssue={null}
        activeIssueRequestKey={0}
        autoSaveLabel="自動保存済み"
        blocks={[createContentBlock()]}
        canCreateTemplate={false}
        canDuplicate
        draftForm={createDraftInput()}
        selectedDraftId="draft-input-1"
        showWhitespace
        signatures={[createSignature()]}
        templates={[createTemplate()]}
        onApplyTemplate={vi.fn()}
        onChangeDraft={vi.fn()}
        onCreateTemplateFromDraft={vi.fn()}
        onDeleteDraft={vi.fn(async () => {})}
        onDuplicateDraft={vi.fn(async () => {})}
        onInsertBlock={vi.fn()}
        onSaveDraft={vi.fn(async () => {})}
        onTogglePinned={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "一覧名" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "件名" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "タグ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "宛名メモ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "書き出し" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "本文" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "結び" })).toBeInTheDocument();
  });
});

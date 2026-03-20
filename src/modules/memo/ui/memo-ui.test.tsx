import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createMemo, createMemoInput } from "../../../test/ui-fixtures";
import { MemoWorkspace } from "./MemoWorkspace";
import { MemoEditorPane } from "./panes/MemoEditorPane";
import { MemoListPane } from "./panes/MemoListPane";

describe("memo UI", () => {
  it("handles memo list interactions", async () => {
    const user = userEvent.setup();
    const handleSelectMemo = vi.fn();
    const handleCreateMemo = vi.fn();
    const handleChangeSearchQuery = vi.fn();
    const handleChangeSort = vi.fn();

    render(
      <MemoListPane
        availableSortOptions={[
          { value: "recent", label: "更新順" },
          { value: "label", label: "タイトル順" },
        ]}
        memos={[createMemo({ isPinned: true })]}
        searchQuery="打ち"
        selectedMemoId="memo-1"
        sort="recent"
        totalMemoCount={3}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
        onCreateMemo={handleCreateMemo}
        onSelectMemo={handleSelectMemo}
      />,
    );

    expect(screen.getByText("1 / 3件")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/Cmd+K")).toBeInTheDocument();
    expect(screen.getByTitle("固定")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "新規" }));
    expect(handleCreateMemo).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "消去" }));
    expect(handleChangeSearchQuery).toHaveBeenCalledWith("");
    await user.selectOptions(screen.getByRole("combobox"), "label");
    expect(handleChangeSort).toHaveBeenCalledWith("label");
    await user.click(screen.getByText("打ち合わせメモ").closest("button") ?? document.body);
    expect(handleSelectMemo).toHaveBeenCalledWith("memo-1");
  });

  it("handles memo editor interactions", async () => {
    const user = userEvent.setup();
    const handleChangeMemo = vi.fn();
    const handleCreateMemo = vi.fn();
    const handleDeleteMemo = vi.fn(async () => {});
    const handleSaveMemo = vi.fn(async () => {});
    const handleTogglePinned = vi.fn();
    const handleStartDraftFromMemo = vi.fn();

    render(
      <MemoEditorPane
        activeMemoUpdatedAt="1710000000000"
        autoSaveLabel="自動保存済み"
        canStartDraftFromMemo
        memoForm={createMemoInput()}
        selectedMemoId="memo-1"
        showWhitespace={false}
        onChangeMemo={handleChangeMemo}
        onCreateMemo={handleCreateMemo}
        onDeleteMemo={handleDeleteMemo}
        onSaveMemo={handleSaveMemo}
        onTogglePinned={handleTogglePinned}
        onStartDraftFromMemo={handleStartDraftFromMemo}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "メモタイトル" }), {
      target: { value: "打ち合わせメモ update" },
    });
    expect(handleChangeMemo).toHaveBeenCalledWith("title", expect.stringContaining("update"));

    const bodyEditor = screen.getByRole("textbox", { name: "メモ本文" });
    await user.click(bodyEditor);
    await user.keyboard("{Enter}follow");
    expect(bodyEditor).toHaveFocus();
    expect(handleChangeMemo).toHaveBeenCalledWith("body", expect.stringContaining("follow"));

    await user.click(screen.getByRole("button", { name: "新規" }));
    expect(handleCreateMemo).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "固定" }));
    expect(handleTogglePinned).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "下書きを作成" }));
    expect(handleStartDraftFromMemo).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(handleDeleteMemo).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveMemo).toHaveBeenCalled();

    expect(screen.getByText(/^保存:/)).toBeInTheDocument();
    expect(screen.getByText(/行/)).toBeInTheDocument();
    expect(screen.getByText(/文字/)).toBeInTheDocument();
  }, 10000);

  it("shows whitespace markers in the footer preview without mutating the raw title", () => {
    render(
      <MemoEditorPane
        activeMemoUpdatedAt={null}
        autoSaveLabel="自動保存待機中"
        canStartDraftFromMemo
        memoForm={createMemoInput({
          title: "A 社メモ",
          body: "田 中",
        })}
        selectedMemoId={null}
        showWhitespace
        onChangeMemo={vi.fn()}
        onCreateMemo={vi.fn()}
        onDeleteMemo={vi.fn(async () => {})}
        onSaveMemo={vi.fn(async () => {})}
        onTogglePinned={vi.fn()}
        onStartDraftFromMemo={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("A 社メモ")).toBeInTheDocument();
    expect(screen.getByText("田·中")).toBeInTheDocument();
  });

  it("connects memo workspace panes", () => {
    render(
      <MemoWorkspace
        activeMemoUpdatedAt={null}
        autoSaveLabel="自動保存待機中"
        availableSortOptions={[{ value: "recent", label: "更新順" }]}
        canStartDraftFromMemo={false}
        memos={[createMemo()]}
        memoForm={createMemoInput()}
        searchQuery=""
        selectedMemoId="memo-1"
        showWhitespace={false}
        sort="recent"
        totalMemoCount={1}
        onChangeMemo={vi.fn()}
        onChangeSearchQuery={vi.fn()}
        onChangeSort={vi.fn()}
        onCreateMemo={vi.fn()}
        onDeleteMemo={vi.fn(async () => {})}
        onSaveMemo={vi.fn(async () => {})}
        onSelectMemo={vi.fn()}
        onTogglePinned={vi.fn()}
        onStartDraftFromMemo={vi.fn()}
      />,
    );

    expect(screen.getByText("メモ一覧")).toBeInTheDocument();
    expect(screen.getByText("メモエディタ")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "メモタイトル" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "メモ本文" })).toBeInTheDocument();
  });
});

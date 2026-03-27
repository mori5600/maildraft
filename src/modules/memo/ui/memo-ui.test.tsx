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
    const handleChangeTagFilter = vi.fn();

    render(
      <MemoListPane
        activeTagFilter={null}
        availableTags={["会議", "議事録"]}
        availableSortOptions={[
          { value: "recent", label: "更新順" },
          { value: "label", label: "タイトル順" },
        ]}
        memos={[createMemo({ isPinned: true, tags: ["会議", "議事録"] })]}
        searchQuery="打ち"
        selectedMemoId="memo-1"
        sort="recent"
        totalMemoCount={3}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
        onChangeTagFilter={handleChangeTagFilter}
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
    await user.click(screen.getByRole("button", { name: "会議" }));
    expect(handleChangeTagFilter).toHaveBeenCalledWith("会議");
    expect(screen.getAllByText("会議")).toHaveLength(2);
    expect(screen.getAllByText("議事録")).toHaveLength(2);
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
        availableTags={["会議", "議事録", "社内"]}
        canStartDraftFromMemo
        memoForm={createMemoInput({ tags: ["会議"] })}
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
    await user.type(screen.getByRole("combobox", { name: "タグ" }), "議事録{Enter}");
    expect(handleChangeMemo).toHaveBeenCalledWith("tags", ["会議", "議事録"]);
    await user.click(screen.getByRole("button", { name: "タグ「会議」を削除" }));
    expect(handleChangeMemo).toHaveBeenCalledWith("tags", []);

    await user.click(screen.getByRole("button", { name: "新規" }));
    expect(handleCreateMemo).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "固定" }));
    expect(handleTogglePinned).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "下書きを作成" }));
    expect(handleStartDraftFromMemo).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "ゴミ箱へ移動" }));
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
        availableTags={["会議"]}
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
        activeTagFilter={null}
        activeMemoUpdatedAt={null}
        autoSaveLabel="自動保存待機中"
        availableTags={["会議"]}
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
        onChangeTagFilter={vi.fn()}
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
    expect(screen.getByRole("combobox", { name: "タグ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "メモタイトル" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "メモ本文" })).toBeInTheDocument();
  });
});

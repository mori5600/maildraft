import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createSignature,
  createSignatureInput,
} from "../../../test/ui-fixtures";
import { SignatureEditorPane } from "./panes/SignatureEditorPane";
import { SignatureListPane } from "./panes/SignatureListPane";
import { SignaturePreviewPane } from "./panes/SignaturePreviewPane";
import { SignatureWorkspace } from "./SignatureWorkspace";

describe("signature UI", () => {
  it("handles signature list interactions", async () => {
    const user = userEvent.setup();
    const handleSelectSignature = vi.fn();
    const handleCreateSignature = vi.fn();
    const handleChangeSearchQuery = vi.fn();
    const handleChangeSort = vi.fn();

    render(
      <SignatureListPane
        searchQuery="署名"
        selectedSignatureId="signature-1"
        signatures={[createSignature({ isPinned: true, isDefault: true })]}
        sort="recent"
        totalSignatureCount={2}
        onChangeSearchQuery={handleChangeSearchQuery}
        onChangeSort={handleChangeSort}
        onCreateSignature={handleCreateSignature}
        onSelectSignature={handleSelectSignature}
      />,
    );

    expect(screen.getByText("1 / 2件")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/Cmd+K")).toBeInTheDocument();
    expect(screen.getByTitle("固定")).toBeInTheDocument();
    expect(screen.getByText("既定")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "新規" }));
    expect(handleCreateSignature).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "消去" }));
    expect(handleChangeSearchQuery).toHaveBeenCalledWith("");
    await user.click(screen.getByText("営業署名").closest("button") ?? document.body);
    expect(handleSelectSignature).toHaveBeenCalledWith("signature-1");
  });

  it("handles signature editor and preview actions", async () => {
    const user = userEvent.setup();
    const handleChangeSignature = vi.fn();
    const handleSaveSignature = vi.fn(async () => {});
    const handleDeleteSignature = vi.fn(async () => {});
    const handleDuplicateSignature = vi.fn(async () => {});
    const handleTogglePinned = vi.fn();
    const handleOpenPreview = vi.fn();

    render(
      <>
        <SignatureEditorPane
          canDuplicate
          selectedSignatureId="signature-input-1"
          showWhitespace={false}
          signatureForm={createSignatureInput()}
          onChangeSignature={handleChangeSignature}
          onDeleteSignature={handleDeleteSignature}
          onDuplicateSignature={handleDuplicateSignature}
          onSaveSignature={handleSaveSignature}
          onTogglePinned={handleTogglePinned}
        />
        <SignaturePreviewPane
          canExpandPreview
          previewBodyText="株式会社△△"
          onOpenPreview={handleOpenPreview}
        />
      </>,
    );

    const nameEditor = screen.getByRole("textbox", { name: "名前" });
    await user.click(nameEditor);
    await user.keyboard("{End}更新");
    expect(handleChangeSignature).toHaveBeenCalledWith("name", expect.stringContaining("更新"));
    const bodyEditor = screen.getByRole("textbox", { name: "本文" });
    await user.click(bodyEditor);
    await user.keyboard("{Enter}追記");
    expect(bodyEditor).toHaveFocus();
    expect(handleChangeSignature).toHaveBeenCalledWith("body", expect.stringContaining("追記"));
    await user.click(screen.getByRole("checkbox"));
    expect(handleChangeSignature).toHaveBeenCalledWith("isDefault", true);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveSignature).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(handleOpenPreview).toHaveBeenCalled();
  });

  it("keeps the signature body in CodeMirror when whitespace is visible", () => {
    render(
      <SignatureEditorPane
        canDuplicate
        selectedSignatureId="signature-input-1"
        showWhitespace
        signatureForm={createSignatureInput()}
        onChangeSignature={vi.fn()}
        onDeleteSignature={vi.fn(async () => {})}
        onDuplicateSignature={vi.fn(async () => {})}
        onSaveSignature={vi.fn(async () => {})}
        onTogglePinned={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "名前" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "本文" })).toBeInTheDocument();
  });

  it("connects signature workspace overlay", async () => {
    const user = userEvent.setup();

    render(
      <SignatureWorkspace
        canDuplicate
        searchQuery=""
        selectedSignatureId="signature-1"
        showWhitespace={false}
        signatureForm={createSignatureInput()}
        signatures={[createSignature()]}
        sort="recent"
        totalSignatureCount={1}
        onChangeSearchQuery={vi.fn()}
        onChangeSignature={vi.fn()}
        onChangeSort={vi.fn()}
        onCreateSignature={vi.fn()}
        onDeleteSignature={vi.fn(async () => {})}
        onDuplicateSignature={vi.fn(async () => {})}
        onSaveSignature={vi.fn(async () => {})}
        onSelectSignature={vi.fn()}
        onTogglePinned={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByText("署名プレビュー")).toBeInTheDocument();
  });
});

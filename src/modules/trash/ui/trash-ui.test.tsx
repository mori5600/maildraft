import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createSignature,
  createTrashDraftItem,
  createTrashedSignature,
  createTrashSignatureItem,
  createTrashTemplateItem,
} from "../../../test/ui-fixtures";
import { TrashDetailPane } from "./panes/TrashDetailPane";
import { TrashListPane } from "./panes/TrashListPane";
import { buildTrashDetail } from "./trash-detail";
import { TrashWorkspace } from "./TrashWorkspace";

describe("trash UI", () => {
  it("renders trash list and handles selection actions", async () => {
    const user = userEvent.setup();
    const handleSelectItem = vi.fn();
    const handleEmptyTrash = vi.fn(async () => {});
    render(
      <TrashListPane
        items={[createTrashDraftItem(), createTrashTemplateItem()]}
        selectedItemKey="draft:draft-1"
        onEmptyTrash={handleEmptyTrash}
        onSelectItem={handleSelectItem}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ゴミ箱を空にする" }));
    expect(handleEmptyTrash).toHaveBeenCalled();
    await user.click(screen.getByText("打ち合わせお礼").closest("button") ?? document.body);
    expect(handleSelectItem).toHaveBeenCalledWith("template:template-1");
  });

  it("renders trash detail and action buttons", async () => {
    const user = userEvent.setup();
    const handleRestoreItem = vi.fn(async () => {});
    const handleDeleteItemPermanently = vi.fn(async () => {});
    render(
      <TrashDetailPane
        item={createTrashDraftItem()}
        showWhitespace={false}
        signatures={[createSignature()]}
        trashedSignatures={[createTrashedSignature()]}
        onDeleteItemPermanently={handleDeleteItemPermanently}
        onRestoreItem={handleRestoreItem}
      />,
    );

    expect(screen.getByText("削除済みの項目を復元または完全削除できます。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "復元" }));
    expect(handleRestoreItem).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "完全削除" }));
    expect(handleDeleteItemPermanently).toHaveBeenCalled();
  });

  it("builds trash detail for each item kind", () => {
    const signatures = [createSignature()];
    const trashedSignatures = [createTrashedSignature()];

    expect(buildTrashDetail(createTrashDraftItem(), signatures, trashedSignatures).meta).toContain(
      "履歴",
    );
    expect(
      buildTrashDetail(createTrashTemplateItem(), signatures, trashedSignatures).meta,
    ).toContain("署名");
    expect(
      buildTrashDetail(createTrashSignatureItem(), signatures, trashedSignatures).body,
    ).toContain("株式会社△△");
  });

  it("connects trash workspace panes", () => {
    render(
      <TrashWorkspace
        items={[createTrashDraftItem()]}
        selectedItemKey="draft:draft-1"
        showWhitespace={false}
        signatures={[createSignature()]}
        trashedSignatures={[createTrashedSignature()]}
        onDeleteItemPermanently={vi.fn(async () => {})}
        onEmptyTrash={vi.fn(async () => {})}
        onRestoreItem={vi.fn(async () => {})}
        onSelectItem={vi.fn()}
      />,
    );

    expect(screen.getByText("ゴミ箱")).toBeInTheDocument();
    expect(screen.getByText("詳細")).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";

import {
  buildTrashItemKey,
  collectTrashItems,
  findTrashSignature,
  trashItemTypeLabel,
  type TrashSnapshot,
} from "./model";

const trash: TrashSnapshot = {
  drafts: [
    {
      draft: {
        id: "draft-1",
        title: "下書きA",
        isPinned: false,
        subject: "件名A",
        recipient: "",
        opening: "",
        body: "",
        closing: "",
        templateId: null,
        signatureId: "signature-trash",
        variableValues: {},
        tags: [],
        createdAt: "1",
        updatedAt: "2",
      },
      history: [],
      deletedAt: "5",
    },
  ],
  templates: [
    {
      template: {
        id: "template-1",
        name: " ",
        isPinned: false,
        subject: "",
        recipient: "",
        opening: "",
        body: "",
        closing: "",
        signatureId: null,
        tags: [],
        createdAt: "1",
        updatedAt: "2",
      },
      deletedAt: "10",
    },
  ],
  signatures: [
    {
      signature: {
        id: "signature-trash",
        name: "",
        isPinned: false,
        body: "署名本文",
        isDefault: false,
        createdAt: "1",
        updatedAt: "2",
      },
      deletedAt: "7",
    },
  ],
  memos: [
    {
      memo: {
        id: "memo-1",
        title: "確認メモ",
        isPinned: false,
        body: "段取りを確認",
        tags: [],
        createdAt: "1",
        updatedAt: "2",
      },
      deletedAt: "8",
    },
  ],
  blocks: [
    {
      block: {
        id: "block-1",
        name: "催促",
        category: "reminder",
        body: "ご確認をお願いいたします。",
        tags: [],
        createdAt: "1",
        updatedAt: "2",
      },
      deletedAt: "9",
    },
  ],
};

describe("trash model", () => {
  it("collects trash items in descending deleted order with fallback labels", () => {
    expect(collectTrashItems(trash).map((item) => [item.kind, item.label, item.key])).toEqual([
      ["template", "無題のテンプレート", "template:template-1"],
      ["block", "催促 / 催促", "block:block-1"],
      ["memo", "確認メモ", "memo:memo-1"],
      ["signature", "無題の署名", "signature:signature-trash"],
      ["draft", "下書きA", "draft:draft-1"],
    ]);
  });

  it("builds keys and labels for each trash item type", () => {
    expect(buildTrashItemKey("draft", "draft-1")).toBe("draft:draft-1");
    expect(trashItemTypeLabel("draft")).toBe("下書き");
    expect(trashItemTypeLabel("template")).toBe("テンプレート");
    expect(trashItemTypeLabel("block")).toBe("文面ブロック");
    expect(trashItemTypeLabel("signature")).toBe("署名");
    expect(trashItemTypeLabel("memo")).toBe("メモ");
  });

  it("finds signatures from active data or trash and returns undefined for null ids", () => {
    expect(
      findTrashSignature(
        [
          {
            id: "signature-active",
            name: "現行署名",
            isPinned: false,
            body: "本文",
            isDefault: true,
            createdAt: "1",
            updatedAt: "2",
          },
        ],
        trash.signatures,
        "signature-active",
      )?.name,
    ).toBe("現行署名");

    expect(findTrashSignature([], trash.signatures, "signature-trash")?.body).toBe("署名本文");
    expect(findTrashSignature([], trash.signatures, null)).toBeUndefined();
  });
});

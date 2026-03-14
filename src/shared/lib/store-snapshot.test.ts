import { describe, expect, it } from "vitest";

import type { StoreSnapshot } from "../types/store";
import {
  getDefaultSignatureId,
  pickDraftInput,
  pickKnownSignatureId,
  pickSignatureInput,
  pickTemplateInput,
  templateExists,
} from "./store-snapshot";

const snapshot: StoreSnapshot = {
  drafts: [
    {
      id: "draft-1",
      title: "下書き",
      isPinned: false,
      subject: "件名",
      recipient: "",
      opening: "",
      body: "",
      closing: "",
      templateId: "template-1",
      signatureId: "signature-default",
      variableValues: {},
      createdAt: "1",
      updatedAt: "2",
    },
  ],
  draftHistory: [],
  variablePresets: [],
  templates: [
    {
      id: "template-1",
      name: "お礼",
      isPinned: false,
      subject: "",
      recipient: "",
      opening: "",
      body: "",
      closing: "",
      signatureId: "signature-default",
      createdAt: "1",
      updatedAt: "2",
    },
  ],
  signatures: [
    {
      id: "signature-default",
      name: "標準署名",
      isPinned: false,
      body: "",
      isDefault: true,
      createdAt: "1",
      updatedAt: "2",
    },
    {
      id: "signature-other",
      name: "営業署名",
      isPinned: false,
      body: "",
      isDefault: false,
      createdAt: "1",
      updatedAt: "1",
    },
  ],
  trash: {
    drafts: [],
    templates: [
      {
        template: {
          id: "template-trash",
          name: "旧テンプレート",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          signatureId: null,
          createdAt: "1",
          updatedAt: "1",
        },
        deletedAt: "10",
      },
    ],
    signatures: [
      {
        signature: {
          id: "signature-trash",
          name: "削除済み署名",
          isPinned: false,
          body: "",
          isDefault: false,
          createdAt: "1",
          updatedAt: "1",
        },
        deletedAt: "10",
      },
    ],
  },
};

describe("store-snapshot helpers", () => {
  it("returns the default signature id and accepts ids from trash", () => {
    expect(getDefaultSignatureId(snapshot)).toBe("signature-default");
    expect(pickKnownSignatureId(snapshot, "signature-trash")).toBe("signature-trash");
    expect(pickKnownSignatureId(snapshot, "missing")).toBe("signature-default");
  });

  it("picks existing entities and falls back to empty defaults", () => {
    expect(pickDraftInput(snapshot, "draft-1")).toMatchObject({ id: "draft-1" });
    expect(pickTemplateInput(snapshot, "template-1")).toMatchObject({ id: "template-1" });
    expect(pickSignatureInput(snapshot, "signature-other")).toMatchObject({
      id: "signature-other",
    });

    const emptySnapshot: StoreSnapshot = {
      drafts: [],
      draftHistory: [],
      variablePresets: [],
      templates: [],
      signatures: [],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
      },
    };

    expect(pickDraftInput(emptySnapshot, null).signatureId).toBeNull();
    expect(pickTemplateInput(emptySnapshot, null).signatureId).toBeNull();
    expect(pickSignatureInput(emptySnapshot, null).isDefault).toBe(true);
  });

  it("finds templates both in active data and trash", () => {
    expect(templateExists(snapshot, "template-1")).toBe(true);
    expect(templateExists(snapshot, "template-trash")).toBe(true);
    expect(templateExists(snapshot, "missing")).toBe(false);
  });
});

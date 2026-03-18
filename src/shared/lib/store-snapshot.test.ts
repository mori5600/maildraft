import { describe, expect, it } from "vitest";

import type { StoreSnapshot } from "../types/store";
import {
  applySavedDraftResult,
  applySavedSignatureResult,
  applySavedTemplateResult,
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

  it("applies compact save payloads without replacing unrelated snapshot data", () => {
    const nextDraftSnapshot = applySavedDraftResult(snapshot, {
      draft: {
        ...snapshot.drafts[0],
        subject: "更新件名",
        updatedAt: "5",
      },
      draftHistory: [
        {
          id: "draft-1-4",
          draftId: "draft-1",
          title: "下書き",
          subject: "件名",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: "template-1",
          signatureId: "signature-default",
          variableValues: {},
          recordedAt: "4",
        },
      ],
    });
    expect(nextDraftSnapshot.drafts[0]?.subject).toBe("更新件名");
    expect(nextDraftSnapshot.draftHistory).toHaveLength(1);

    const nextTemplateSnapshot = applySavedTemplateResult(snapshot, {
      template: {
        ...snapshot.templates[0],
        name: "更新テンプレート",
        updatedAt: "5",
      },
    });
    expect(nextTemplateSnapshot.templates[0]?.name).toBe("更新テンプレート");

    const nextSignatureSnapshot = applySavedSignatureResult(snapshot, {
      signatures: [
        {
          ...snapshot.signatures[1],
          isDefault: true,
          updatedAt: "5",
        },
        {
          ...snapshot.signatures[0],
          isDefault: false,
          updatedAt: "4",
        },
      ],
    });
    expect(nextSignatureSnapshot.signatures[0]?.id).toBe("signature-other");
    expect(nextSignatureSnapshot.signatures[0]?.isDefault).toBe(true);
  });
});

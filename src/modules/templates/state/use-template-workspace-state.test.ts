import { afterAll, describe, expect, it, vi } from "vitest";

import type { StoreSnapshot } from "../../../shared/types/store";
import { buildTemplateEditingState } from "./use-template-workspace-state";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000001");

const snapshot: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  templates: [
    {
      id: "template-1",
      name: "お礼",
      isPinned: false,
      subject: "件名",
      recipient: "株式会社〇〇",
      opening: "冒頭",
      body: "本文",
      closing: "末尾",
      signatureId: "signature-1",
      createdAt: "1",
      updatedAt: "2",
    },
    {
      id: "template-2",
      name: "確認",
      isPinned: false,
      subject: "別件名",
      recipient: "",
      opening: "",
      body: "",
      closing: "",
      signatureId: null,
      createdAt: "1",
      updatedAt: "1",
    },
  ],
  signatures: [
    {
      id: "signature-1",
      name: "標準署名",
      isPinned: false,
      body: "署名本文",
      isDefault: true,
      createdAt: "1",
      updatedAt: "1",
    },
  ],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

describe("template workspace state", () => {
  it("picks the preferred template when it exists", () => {
    expect(buildTemplateEditingState(snapshot, "template-2")).toMatchObject({
      selectedTemplateId: "template-2",
      templateForm: {
        id: "template-2",
        name: "確認",
      },
    });
  });

  it("falls back to the first template and creates an empty form when no template exists", () => {
    expect(buildTemplateEditingState(snapshot, "missing")).toMatchObject({
      selectedTemplateId: "template-1",
      templateForm: {
        id: "template-1",
        signatureId: "signature-1",
      },
    });

    expect(
      buildTemplateEditingState({
        drafts: [],
        draftHistory: [],
        variablePresets: [],
        templates: [],
        signatures: snapshot.signatures,
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
        },
      }),
    ).toMatchObject({
      selectedTemplateId: null,
      templateForm: {
        id: "00000000-0000-4000-8000-000000000001",
        signatureId: "signature-1",
      },
    });
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

import { afterAll, describe, expect, it, vi } from "vitest";

import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createInitialTemplateState,
  formatTemplateAutoSaveState,
  hasMeaningfulTemplateContent,
  shouldAutoPersistTemplate,
  toTemplateWorkspaceErrorMessage,
} from "./template-workspace-helpers";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000004");

const snapshot: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  templates: [
    {
      id: "template-1",
      name: "お礼テンプレート",
      isPinned: false,
      subject: "件名",
      recipient: "株式会社〇〇",
      opening: "冒頭",
      body: "本文",
      closing: "末尾",
      signatureId: "signature-1",
      tags: [],
      createdAt: "1",
      updatedAt: "2",
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
      updatedAt: "2",
    },
  ],
  memos: [],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

describe("template workspace helpers", () => {
  it("builds the initial template state from the first template or a new empty template", () => {
    expect(createInitialTemplateState(snapshot)).toMatchObject({
      autoSaveState: "saved",
      selectedTemplateId: "template-1",
      templateForm: {
        id: "template-1",
        signatureId: "signature-1",
      },
    });

    expect(
      createInitialTemplateState({
        ...snapshot,
        templates: [],
      }),
    ).toMatchObject({
      autoSaveState: "idle",
      selectedTemplateId: null,
      templateForm: {
        id: "00000000-0000-4000-8000-000000000004",
        signatureId: "signature-1",
      },
    });
  });

  it("decides whether a template needs persistence", () => {
    expect(
      hasMeaningfulTemplateContent(
        {
          id: "template-2",
          name: "新しいテンプレート",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          signatureId: "signature-1",
          tags: [],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistTemplate(
        {
          id: "template-2",
          name: "新しいテンプレート",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          signatureId: "signature-1",
          tags: [],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistTemplate(
        {
          id: "template-2",
          name: "新しいテンプレート",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          signatureId: null,
          tags: [],
        },
        snapshot,
      ),
    ).toBe(true);

    expect(
      shouldAutoPersistTemplate(
        {
          id: "template-1",
          name: "お礼テンプレート",
          isPinned: false,
          subject: "更新件名",
          recipient: "株式会社〇〇",
          opening: "冒頭",
          body: "本文",
          closing: "末尾",
          signatureId: "signature-1",
          tags: [],
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("formats autosave states and normalizes unknown errors", () => {
    expect(formatTemplateAutoSaveState("idle")).toBe("自動保存待機中");
    expect(formatTemplateAutoSaveState("dirty")).toBe("未保存の変更があります");
    expect(formatTemplateAutoSaveState("saving")).toBe("自動保存しています");
    expect(formatTemplateAutoSaveState("saved")).toBe("自動保存済み");
    expect(formatTemplateAutoSaveState("error")).toBe("自動保存に失敗しました");

    expect(toTemplateWorkspaceErrorMessage(new Error("保存に失敗しました"))).toBe(
      "保存に失敗しました",
    );
    expect(toTemplateWorkspaceErrorMessage("読み込みに失敗しました")).toBe(
      "読み込みに失敗しました",
    );
    expect(toTemplateWorkspaceErrorMessage({ reason: "unknown" })).toBe("処理に失敗しました。");
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

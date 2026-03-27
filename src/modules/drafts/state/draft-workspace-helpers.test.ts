import { afterAll, describe, expect, it, vi } from "vitest";

import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createInitialDraftState,
  formatDraftAutoSaveState,
  hasMeaningfulDraftContent,
  shouldAutoPersistDraft,
  toDraftWorkspaceErrorMessage,
} from "./draft-workspace-helpers";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000003");

const snapshot: StoreSnapshot = {
  drafts: [
    {
      id: "draft-1",
      title: "日程調整",
      isPinned: false,
      subject: "件名",
      recipient: "株式会社〇〇",
      opening: "お世話になっております。",
      body: "本文です。",
      closing: "よろしくお願いいたします。",
      templateId: null,
      signatureId: "signature-1",
      variableValues: {
        company: "株式会社〇〇",
      },
      tags: [],
      createdAt: "1",
      updatedAt: "2",
    },
  ],
  draftHistory: [],
  variablePresets: [],
  templates: [],
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

describe("draft workspace helpers", () => {
  it("builds the initial draft state from the first draft or a new empty draft", () => {
    expect(createInitialDraftState(snapshot)).toMatchObject({
      autoSaveState: "saved",
      selectedDraftId: "draft-1",
      draftForm: {
        id: "draft-1",
        signatureId: "signature-1",
      },
    });

    expect(
      createInitialDraftState({
        ...snapshot,
        drafts: [],
      }),
    ).toMatchObject({
      autoSaveState: "idle",
      selectedDraftId: null,
      draftForm: {
        id: "00000000-0000-4000-8000-000000000003",
        signatureId: "signature-1",
      },
    });
  });

  it("decides whether a draft needs persistence", () => {
    expect(
      shouldAutoPersistDraft(
        {
          id: "draft-2",
          title: "",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: "signature-1",
          variableValues: {},
          tags: [],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      hasMeaningfulDraftContent(
        {
          id: "draft-2",
          title: "",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: "signature-1",
          variableValues: {},
          tags: [],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      hasMeaningfulDraftContent(
        {
          id: "draft-2",
          title: "",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: null,
          variableValues: {},
          tags: [],
        },
        snapshot,
      ),
    ).toBe(true);

    expect(
      shouldAutoPersistDraft(
        {
          id: "draft-1",
          title: "日程調整",
          isPinned: false,
          subject: "件名",
          recipient: "株式会社〇〇",
          opening: "お世話になっております。",
          body: "本文です。",
          closing: "よろしくお願いいたします。",
          templateId: null,
          signatureId: "signature-1",
          variableValues: {
            company: "株式会社〇〇",
          },
          tags: [],
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistDraft(
        {
          id: "draft-2",
          title: "",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: null,
          variableValues: {},
          tags: [],
        },
        snapshot,
      ),
    ).toBe(true);

    expect(
      shouldAutoPersistDraft(
        {
          id: "draft-1",
          title: "日程調整",
          isPinned: false,
          subject: "更新件名",
          recipient: "株式会社〇〇",
          opening: "お世話になっております。",
          body: "本文です。",
          closing: "よろしくお願いいたします。",
          templateId: null,
          signatureId: "signature-1",
          variableValues: {
            company: "株式会社〇〇",
          },
          tags: [],
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("formats autosave states and normalizes unknown errors", () => {
    expect(formatDraftAutoSaveState("idle")).toBe("自動保存待機中");
    expect(formatDraftAutoSaveState("dirty")).toBe("未保存の変更があります");
    expect(formatDraftAutoSaveState("saving")).toBe("自動保存しています");
    expect(formatDraftAutoSaveState("saved")).toBe("自動保存済み");
    expect(formatDraftAutoSaveState("error")).toBe("自動保存に失敗しました");

    expect(toDraftWorkspaceErrorMessage(new Error("保存に失敗しました"))).toBe(
      "保存に失敗しました",
    );
    expect(toDraftWorkspaceErrorMessage("読み込みに失敗しました")).toBe("読み込みに失敗しました");
    expect(toDraftWorkspaceErrorMessage({ reason: "unknown" })).toBe("処理に失敗しました。");
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

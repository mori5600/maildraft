import { afterAll, describe, expect, it, vi } from "vitest";

import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createInitialSignatureState,
  formatSignatureAutoSaveState,
  hasMeaningfulSignatureContent,
  shouldAutoPersistSignature,
  toSignatureWorkspaceErrorMessage,
} from "./signature-workspace-helpers";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000005");

const snapshot: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  blocks: [],
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
    memos: [],
    blocks: [],
  },
};

describe("signature workspace helpers", () => {
  it("builds the initial signature state from the first signature or a new empty signature", () => {
    expect(createInitialSignatureState(snapshot)).toMatchObject({
      autoSaveState: "saved",
      selectedSignatureId: "signature-1",
      signatureForm: {
        id: "signature-1",
        isDefault: true,
      },
    });

    expect(
      createInitialSignatureState({
        ...snapshot,
        signatures: [],
      }),
    ).toMatchObject({
      autoSaveState: "idle",
      selectedSignatureId: null,
      signatureForm: {
        id: "00000000-0000-4000-8000-000000000005",
        isDefault: true,
      },
    });
  });

  it("decides whether a signature needs persistence", () => {
    expect(
      hasMeaningfulSignatureContent(
        {
          id: "signature-2",
          name: "新しい署名",
          isPinned: false,
          body: "",
          isDefault: false,
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistSignature(
        {
          id: "signature-2",
          name: "新しい署名",
          isPinned: false,
          body: "",
          isDefault: false,
        },
        snapshot,
      ),
    ).toBe(false);

    expect(
      shouldAutoPersistSignature(
        {
          id: "signature-2",
          name: "新しい署名",
          isPinned: false,
          body: "",
          isDefault: true,
        },
        snapshot,
      ),
    ).toBe(true);

    expect(
      shouldAutoPersistSignature(
        {
          id: "signature-1",
          name: "標準署名",
          isPinned: false,
          body: "更新本文",
          isDefault: true,
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("formats autosave states and normalizes unknown errors", () => {
    expect(formatSignatureAutoSaveState("idle")).toBe("自動保存待機中");
    expect(formatSignatureAutoSaveState("dirty")).toBe("未保存の変更があります");
    expect(formatSignatureAutoSaveState("saving")).toBe("自動保存しています");
    expect(formatSignatureAutoSaveState("saved")).toBe("自動保存済み");
    expect(formatSignatureAutoSaveState("error")).toBe("自動保存に失敗しました");

    expect(toSignatureWorkspaceErrorMessage(new Error("保存に失敗しました"))).toBe(
      "保存に失敗しました",
    );
    expect(toSignatureWorkspaceErrorMessage("読み込みに失敗しました")).toBe(
      "読み込みに失敗しました",
    );
    expect(toSignatureWorkspaceErrorMessage({ reason: "unknown" })).toBe("処理に失敗しました。");
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

import { describe, expect, it } from "vitest";

import type { TrashItem } from "../../modules/trash/model";
import type { StoreSnapshot } from "../../shared/types/store";
import {
  buildHydratedWorkspaceState,
  buildWorkspaceSummaries,
  resolveCreateShortcutAction,
  resolvePinShortcutAction,
  resolveSaveShortcutAction,
  resolveSelectedTrashItemKey,
  resolveShortcutIntent,
  toErrorMessage,
} from "./maildraft-app-helpers";

const populatedSnapshot: StoreSnapshot = {
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
  trash: {
    drafts: [],
    templates: [
      {
        template: {
          id: "template-trash",
          name: "削除済みテンプレート",
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
        deletedAt: "9",
      },
    ],
    signatures: [],
  },
};

const trashItems: TrashItem[] = [
  {
    kind: "template",
    key: "template:template-2",
    deletedAt: "20",
    label: "失効テンプレート",
    template: {
      id: "template-2",
      name: "失効テンプレート",
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
  },
  {
    kind: "signature",
    key: "signature:signature-2",
    deletedAt: "10",
    label: "旧署名",
    signature: {
      id: "signature-2",
      name: "旧署名",
      isPinned: false,
      body: "本文",
      isDefault: false,
      createdAt: "1",
      updatedAt: "1",
    },
  },
];

describe("maildraft app helpers", () => {
  it("converts unknown errors into stable user messages", () => {
    expect(toErrorMessage(new Error("保存に失敗しました"))).toBe("保存に失敗しました");
    expect(toErrorMessage("読み込みに失敗しました")).toBe("読み込みに失敗しました");
    expect(toErrorMessage({ reason: "unknown" })).toBe("処理に失敗しました。");
  });

  it("builds workspace summaries in the fixed sidebar order", () => {
    expect(
      buildWorkspaceSummaries({
        draftCount: 1,
        templateCount: 1,
        signatureCount: 1,
        trashItemCount: 2,
      }),
    ).toEqual([
      { id: "drafts", label: "下書き", count: 1 },
      { id: "templates", label: "テンプレート", count: 1 },
      { id: "signatures", label: "署名", count: 1 },
      { id: "trash", label: "ゴミ箱", count: 2 },
      { id: "settings", label: "設定" },
      { id: "help", label: "ヘルプ" },
    ]);
  });

  it("builds hydrated workspace state from the first template, signature, and trash item", () => {
    expect(buildHydratedWorkspaceState(populatedSnapshot)).toMatchObject({
      selectedTemplateId: "template-1",
      selectedSignatureId: "signature-1",
      selectedTrashItemKey: "template:template-trash",
      templateForm: {
        id: "template-1",
        signatureId: "signature-1",
      },
      signatureForm: {
        id: "signature-1",
        isDefault: true,
      },
    });

    expect(
      buildHydratedWorkspaceState({
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
      }),
    ).toMatchObject({
      selectedTemplateId: null,
      selectedSignatureId: null,
      selectedTrashItemKey: null,
      templateForm: {
        signatureId: null,
      },
      signatureForm: {
        isDefault: true,
      },
    });
  });

  it("keeps a valid trash selection and otherwise falls back to the first item", () => {
    expect(resolveSelectedTrashItemKey([], "template:template-2")).toBeNull();
    expect(resolveSelectedTrashItemKey(trashItems, "signature:signature-2")).toBe(
      "signature:signature-2",
    );
    expect(resolveSelectedTrashItemKey(trashItems, "missing")).toBe("template:template-2");
    expect(resolveSelectedTrashItemKey(trashItems, null)).toBe("template:template-2");
  });

  it("resolves sidebar shortcut actions without view-specific branching in the hook", () => {
    expect(resolveCreateShortcutAction("drafts")).toBe("createDraft");
    expect(resolveCreateShortcutAction("trash")).toBe("createDraft");

    expect(resolveSaveShortcutAction("templates")).toBe("saveTemplate");
    expect(resolveSaveShortcutAction("settings")).toBe("saveLoggingSettings");
    expect(resolveSaveShortcutAction("help")).toBeNull();

    expect(resolvePinShortcutAction("drafts")).toBe("toggleDraftPinned");
    expect(resolvePinShortcutAction("signatures")).toBe("toggleSignaturePinned");
    expect(resolvePinShortcutAction("settings")).toBeNull();
  });

  it("resolves keyboard shortcuts into pure intents", () => {
    expect(
      resolveShortcutIntent({
        currentView: "drafts",
        key: "k",
        shiftKey: false,
      }),
    ).toEqual({ kind: "focusSearch", view: "drafts" });
    expect(
      resolveShortcutIntent({
        currentView: "templates",
        key: "1",
        shiftKey: false,
      }),
    ).toEqual({ kind: "changeView", view: "drafts" });
    expect(
      resolveShortcutIntent({
        currentView: "templates",
        key: "n",
        shiftKey: false,
      }),
    ).toEqual({ kind: "createForView", view: "templates" });
    expect(
      resolveShortcutIntent({
        currentView: "settings",
        key: "s",
        shiftKey: false,
      }),
    ).toEqual({ kind: "saveForView", view: "settings" });
    expect(
      resolveShortcutIntent({
        currentView: "signatures",
        key: "P",
        shiftKey: true,
      }),
    ).toEqual({ kind: "pinForView", view: "signatures" });
    expect(
      resolveShortcutIntent({
        currentView: "drafts",
        key: "c",
        shiftKey: true,
      }),
    ).toEqual({ kind: "copyDraftPreview" });
    expect(
      resolveShortcutIntent({
        currentView: "help",
        key: "c",
        shiftKey: true,
      }),
    ).toEqual({ kind: "none" });
  });
});

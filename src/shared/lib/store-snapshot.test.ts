import { describe, expect, it } from "vitest";

import type { StoreSnapshot } from "../types/store";
import {
  applyDeletedDraftResult,
  applyDeletedMemoResult,
  applyDeletedSignatureResult,
  applyDeletedTemplateResult,
  applyRestoredDraftResult,
  applyRestoredMemoResult,
  applyRestoredSignatureResult,
  applyRestoredTemplateResult,
  applySavedDraftResult,
  applySavedMemoResult,
  applySavedSignatureResult,
  applySavedTemplateResult,
  applyTrashMutationResult,
  applyVariablePresetResult,
  getDefaultSignatureId,
  pickDraftInput,
  pickKnownSignatureId,
  pickMemoInput,
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
  memos: [
    {
      id: "memo-1",
      title: "営業メモ",
      body: "論点整理",
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
    memos: [],
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
      memos: [],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    };

    expect(pickDraftInput(emptySnapshot, null).signatureId).toBeNull();
    expect(pickMemoInput(snapshot, "memo-1")).toEqual({
      id: "memo-1",
      title: "営業メモ",
      body: "論点整理",
    });
    expect(pickMemoInput(emptySnapshot, null).title).toBe("");
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

    const nextMemoSnapshot = applySavedMemoResult(snapshot, {
      ...snapshot.memos[0],
      body: "更新済みメモ",
      updatedAt: "5",
    });
    expect(nextMemoSnapshot.memos[0].body).toBe("更新済みメモ");
    expect(nextMemoSnapshot.memos[0].id).toBe("memo-1");
  });

  it("applies compact delete and restore payloads without replacing the full snapshot", () => {
    const draftHistoryEntry = {
      id: "draft-1-history",
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
      recordedAt: "3",
    };
    const snapshotWithHistory: StoreSnapshot = {
      ...snapshot,
      draftHistory: [draftHistoryEntry],
    };

    const deletedDraftSnapshot = applyDeletedDraftResult(snapshotWithHistory, {
      trashedDraft: {
        draft: snapshot.drafts[0],
        history: [draftHistoryEntry],
        deletedAt: "11",
      },
    });
    expect(deletedDraftSnapshot.drafts).toHaveLength(0);
    expect(deletedDraftSnapshot.draftHistory).toHaveLength(0);
    expect(deletedDraftSnapshot.trash.drafts).toHaveLength(1);

    const restoredDraftSnapshot = applyRestoredDraftResult(deletedDraftSnapshot, {
      draft: snapshot.drafts[0],
      draftHistory: [draftHistoryEntry],
    });
    expect(restoredDraftSnapshot.drafts[0]?.id).toBe("draft-1");
    expect(restoredDraftSnapshot.draftHistory).toHaveLength(1);
    expect(restoredDraftSnapshot.trash.drafts).toHaveLength(0);

    const deletedTemplateSnapshot = applyDeletedTemplateResult(snapshot, {
      trashedTemplate: {
        template: snapshot.templates[0],
        deletedAt: "12",
      },
    });
    expect(deletedTemplateSnapshot.templates).toHaveLength(0);
    expect(deletedTemplateSnapshot.trash.templates[0]?.template.id).toBe("template-1");

    const restoredTemplateSnapshot = applyRestoredTemplateResult(deletedTemplateSnapshot, {
      template: snapshot.templates[0],
    });
    expect(restoredTemplateSnapshot.templates[0]?.id).toBe("template-1");
    expect(restoredTemplateSnapshot.trash.templates).toHaveLength(1);
    expect(
      restoredTemplateSnapshot.trash.templates.some(
        (entry) => entry.template.id === "template-1",
      ),
    ).toBe(false);

    const deletedSignatureSnapshot = applyDeletedSignatureResult(snapshot, {
      signatures: [snapshot.signatures[0]],
      trashedSignature: {
        signature: snapshot.signatures[1],
        deletedAt: "13",
      },
    });
    expect(deletedSignatureSnapshot.signatures).toHaveLength(1);
    expect(deletedSignatureSnapshot.trash.signatures[0]?.signature.id).toBe("signature-other");

    const restoredSignatureSnapshot = applyRestoredSignatureResult(
      deletedSignatureSnapshot,
      {
        signatures: snapshot.signatures,
      },
      "signature-other",
    );
    expect(restoredSignatureSnapshot.signatures).toHaveLength(2);
    expect(
      restoredSignatureSnapshot.trash.signatures.some(
        (entry) => entry.signature.id === "signature-other",
      ),
    ).toBe(false);

    const deletedMemoSnapshot = applyDeletedMemoResult(snapshot, {
      trashedMemo: {
        memo: snapshot.memos[0],
        deletedAt: "14",
      },
    });
    expect(deletedMemoSnapshot.memos).toHaveLength(0);
    expect(deletedMemoSnapshot.trash.memos?.[0]?.memo.id).toBe("memo-1");

    const restoredMemoSnapshot = applyRestoredMemoResult(deletedMemoSnapshot, snapshot.memos[0]);
    expect(restoredMemoSnapshot.memos[0]?.id).toBe("memo-1");
    expect(restoredMemoSnapshot.trash.memos ?? []).toHaveLength(0);
  });

  it("applies compact trash cleanup payloads without replacing unrelated collections", () => {
    const nextAfterTemplateDelete = applyTrashMutationResult(snapshot, {
      drafts: [
        {
          ...snapshot.drafts[0],
          templateId: null,
        },
      ],
      draftHistory: [
        {
          id: "draft-1-history",
          draftId: "draft-1",
          title: "下書き",
          subject: "件名",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: "signature-default",
          variableValues: {},
          recordedAt: "3",
        },
      ],
      trash: {
        ...snapshot.trash,
        templates: [],
      },
    });
    expect(nextAfterTemplateDelete.drafts[0]?.templateId).toBeNull();
    expect(nextAfterTemplateDelete.draftHistory[0]?.templateId).toBeNull();
    expect(nextAfterTemplateDelete.templates[0]?.id).toBe("template-1");
    expect(nextAfterTemplateDelete.signatures[0]?.id).toBe("signature-default");
    expect(nextAfterTemplateDelete.trash.templates).toHaveLength(0);

    const nextAfterEmptyTrash = applyTrashMutationResult(snapshot, {
      drafts: [
        {
          ...snapshot.drafts[0],
          templateId: "template-1",
          signatureId: null,
        },
      ],
      draftHistory: [],
      templates: [
        {
          ...snapshot.templates[0],
          signatureId: null,
        },
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    expect(nextAfterEmptyTrash.drafts[0]?.signatureId).toBeNull();
    expect(nextAfterEmptyTrash.templates[0]?.signatureId).toBeNull();
    expect(nextAfterEmptyTrash.signatures.map((signature) => signature.id)).toEqual([
      "signature-default",
      "signature-other",
    ]);
    expect(nextAfterEmptyTrash.trash.signatures).toHaveLength(0);
  });

  it("applies compact variable preset payloads without replacing unrelated collections", () => {
    const nextSnapshot = applyVariablePresetResult(snapshot, {
      variablePresets: [
        {
          id: "preset-2",
          name: "B社向け",
          values: { 相手名: "高橋様" },
          createdAt: "10",
          updatedAt: "20",
        },
      ],
    });

    expect(nextSnapshot.variablePresets.map((preset) => preset.id)).toEqual(["preset-2"]);
    expect(nextSnapshot.drafts).toEqual(snapshot.drafts);
    expect(nextSnapshot.templates).toEqual(snapshot.templates);
    expect(nextSnapshot.trash).toEqual(snapshot.trash);
  });
});

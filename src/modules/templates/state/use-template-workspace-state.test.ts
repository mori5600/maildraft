import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import type { StoreSnapshot } from "../../../shared/types/store";
import { buildTrashItemKey } from "../../trash/model";
import {
  buildTemplateEditingState,
  useTemplateWorkspaceState,
} from "./use-template-workspace-state";

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
      tags: [],
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
      tags: [],
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
  memos: [],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

describe("template workspace state", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

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
        memos: [],
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
  it("deletes a template via compact payload and keeps the remaining template selected", async () => {
    const onSnapshotChange = vi.fn();
    const onTrashItemSelect = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "deleteTemplate").mockResolvedValue({
      trashedTemplate: {
        template: snapshot.templates[0],
        deletedAt: "20",
      },
    });

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange,
        onTrashItemSelect,
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    expect(result.current.templateWorkspaceProps.selectedTemplateId).toBe("template-1");

    await act(async () => {
      await result.current.templateWorkspaceProps.onDeleteTemplate();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.templates.map((template: { id: string }) => template.id)).toEqual([
      "template-2",
    ]);
    expect(nextSnapshot.trash.templates[0]?.template.id).toBe("template-1");

    await waitFor(() => {
      expect(result.current.templateWorkspaceProps.selectedTemplateId).toBe("template-2");
    });
    expect(onTrashItemSelect).toHaveBeenCalledWith(buildTrashItemKey("template", "template-1"));
    expect(onNotice).toHaveBeenCalledWith("テンプレートをゴミ箱に移動しました。");
  });

  it("saves the active template through a compact payload", async () => {
    const savedTemplate = {
      ...snapshot.templates[0],
      name: "更新済みテンプレート",
      updatedAt: "3",
    };
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();
    const saveTemplateSpy = vi.spyOn(maildraftApi, "saveTemplate").mockResolvedValue({
      template: savedTemplate,
    });

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange,
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    act(() => {
      result.current.templateWorkspaceProps.onChangeTemplate("name", "更新済みテンプレート");
    });

    await act(async () => {
      await result.current.templateWorkspaceProps.onSaveTemplate();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    expect(saveTemplateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "template-1",
        name: "更新済みテンプレート",
      }),
    );
    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.templates[0]?.name).toBe("更新済みテンプレート");
    expect(result.current.templateWorkspaceProps.selectedTemplateId).toBe("template-1");
    expect(onNotice).toHaveBeenCalledWith("テンプレートを保存しました。");
  });

  it("autosaves a dirty template after the debounce interval", async () => {
    vi.useFakeTimers();

    const savedTemplate = {
      ...snapshot.templates[0],
      tags: ["自動保存"],
      updatedAt: "3",
    };
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();
    const saveTemplateSpy = vi.spyOn(maildraftApi, "saveTemplate").mockResolvedValue({
      template: savedTemplate,
    });

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange,
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    act(() => {
      result.current.templateWorkspaceProps.onChangeTemplate("tags", ["自動保存"]);
    });

    expect(result.current.templateWorkspaceProps.autoSaveLabel).toBe("未保存の変更があります");
    expect(saveTemplateSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    expect(saveTemplateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "template-1",
        tags: ["自動保存"],
      }),
    );
    expect(onSnapshotChange.mock.calls[0][0].templates[0]?.tags).toEqual(["自動保存"]);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it("duplicates the active template through a compact save payload", async () => {
    const duplicatedTemplate = {
      ...snapshot.templates[0],
      id: "00000000-0000-4000-8000-000000000001",
      name: "お礼 コピー",
      updatedAt: "3",
    };
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "saveTemplate").mockResolvedValue({
      template: duplicatedTemplate,
    });

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange,
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    await act(async () => {
      await result.current.templateWorkspaceProps.onDuplicateTemplate();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.templates.map((template: { id: string }) => template.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "template-1",
      "template-2",
    ]);
    expect(result.current.templateWorkspaceProps.selectedTemplateId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result.current.templateWorkspaceProps.templateForm.name).toBe("お礼 コピー");
    expect(onNotice).toHaveBeenCalledWith("テンプレートを複製しました。");
  });

  it("creates a new template instead of deleting when nothing is selected", async () => {
    const deleteTemplateSpy = vi.spyOn(maildraftApi, "deleteTemplate");
    const onNotice = vi.fn();
    const onViewChange = vi.fn();

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot: {
          ...snapshot,
          templates: [],
        },
      }),
    );

    await act(async () => {
      await result.current.templateWorkspaceProps.onDeleteTemplate();
    });

    expect(deleteTemplateSpy).not.toHaveBeenCalled();
    expect(result.current.templateWorkspaceProps.selectedTemplateId).toBeNull();
    expect(onViewChange).toHaveBeenCalledWith("templates");
    expect(onNotice).toHaveBeenCalledWith("新しいテンプレートを作成しています。");
  });

  it("keeps trashed signature ids and falls back only when the signature fully disappears", () => {
    const snapshotWithTrashedSignature: StoreSnapshot = {
      ...snapshot,
      templates: [
        {
          ...snapshot.templates[0],
          signatureId: "signature-trash",
        },
      ],
      trash: {
        ...snapshot.trash,
        signatures: [
          {
            signature: {
              id: "signature-trash",
              name: "削除済み署名",
              isPinned: false,
              body: "本文",
              isDefault: false,
              createdAt: "1",
              updatedAt: "1",
            },
            deletedAt: "10",
          },
        ],
      },
    };

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot: snapshotWithTrashedSignature,
      }),
    );

    expect(result.current.templateWorkspaceProps.templateForm.signatureId).toBe("signature-trash");

    act(() => {
      result.current.syncTemplateSignatureId(snapshotWithTrashedSignature);
    });
    expect(result.current.templateWorkspaceProps.templateForm.signatureId).toBe("signature-trash");

    act(() => {
      result.current.syncTemplateSignatureId(snapshot);
    });
    expect(result.current.templateWorkspaceProps.templateForm.signatureId).toBe("signature-1");
  });

  it("starts a draft from an unsaved template using the latest default signature", () => {
    const onNotice = vi.fn();
    const onOpenDraftInput = vi.fn();
    const onViewChange = vi.fn();

    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onOpenDraftInput,
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot: {
          ...snapshot,
          templates: [],
          signatures: [
            {
              id: "signature-latest",
              name: "最新署名",
              isPinned: false,
              body: "署名本文",
              isDefault: true,
              createdAt: "1",
              updatedAt: "2",
            },
          ],
          trash: {
            drafts: [],
            templates: [],
            signatures: [],
          },
        },
      }),
    );

    act(() => {
      result.current.templateWorkspaceProps.onChangeTemplate("name", "未保存テンプレート");
      result.current.templateWorkspaceProps.onChangeTemplate("subject", "未保存件名");
      result.current.templateWorkspaceProps.onChangeTemplate("signatureId", null);
    });

    act(() => {
      result.current.templateWorkspaceProps.onStartDraftFromTemplate();
    });

    expect(onOpenDraftInput).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "未保存テンプレート",
        subject: "未保存件名",
        signatureId: "signature-latest",
      }),
    );
    expect(onViewChange).toHaveBeenCalledWith("drafts");
    expect(onNotice).toHaveBeenCalledWith("未保存のテンプレートから新しい下書きを起こしました。");
  });

  it("filters templates by search query and active tag", () => {
    const { result } = renderHook(() =>
      useTemplateWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice: vi.fn(),
        onOpenDraftInput: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot: {
          ...snapshot,
          templates: [
            {
              ...snapshot.templates[0],
              id: "template-1",
              name: "お礼",
              tags: ["社外"],
            },
            {
              ...snapshot.templates[1],
              id: "template-2",
              name: "確認",
              tags: ["社内"],
            },
          ],
        },
      }),
    );

    act(() => {
      result.current.templateWorkspaceProps.onChangeSearchQuery("社外");
    });

    expect(result.current.templateWorkspaceProps.templates.map((template) => template.id)).toEqual([
      "template-1",
    ]);
    expect(result.current.templateWorkspaceProps.availableTags).toEqual(["社外", "社内"]);

    act(() => {
      result.current.templateWorkspaceProps.onChangeSearchQuery("");
      result.current.templateWorkspaceProps.onChangeTagFilter("社内");
    });

    expect(result.current.templateWorkspaceProps.activeTagFilter).toBe("社内");
    expect(result.current.templateWorkspaceProps.templates.map((template) => template.id)).toEqual([
      "template-2",
    ]);
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});

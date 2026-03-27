import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDraft,
  createDraftInput,
  createSignature,
  createStoreSnapshot,
  createTemplate,
} from "../../../test/ui-fixtures";
import { useDraftWorkspaceState } from "./use-draft-workspace-state";

const originalWorker = globalThis.Worker;

const mockState = vi.hoisted(() => ({
  copyPlainText: vi.fn(),
  createDetailedRunner: vi.fn(),
  persistenceOptions: [] as Array<unknown>,
  persistenceState: {} as Record<string, unknown>,
  renderIssues: [] as Array<{
    description: string;
    excerpt: string;
    field: "body" | "closing" | "opening" | "recipient" | "signature" | "subject";
    id: string;
    ruleId: string;
    severity: "error" | "info" | "warning";
    suggestion?: {
      edits: Array<{
        field: "body" | "closing" | "opening" | "recipient" | "subject";
        from: number;
        originalText: string;
        replacement: string;
        to: number;
      }>;
      label: string;
    };
    title: string;
  }>,
  variablePresetState: {} as Record<string, unknown>,
}));

vi.mock("../../../shared/lib/clipboard", () => ({
  copyPlainText: mockState.copyPlainText,
}));

vi.mock("../../renderer/render-draft", () => ({
  buildDraftRenderResult: () => ({
    issues: mockState.renderIssues,
    previewSubject: "preview subject",
    previewText: "preview text",
  }),
  collectDraftVariableNames: () => ["相手名"],
  renderDraftPreview: () => "rendered preview",
}));

vi.mock("../proofreading/create-proofreading-runner", () => ({
  createDraftProofreadingRunner: () => mockState.createDetailedRunner(),
}));

vi.mock("./use-draft-persistence-state", () => ({
  useDraftPersistenceState: (options: unknown) => {
    mockState.persistenceOptions.push(options);
    return mockState.persistenceState;
  },
}));

vi.mock("./use-draft-variable-presets-state", () => ({
  useDraftVariablePresetsState: () => mockState.variablePresetState,
}));

function createCleanSnapshot(overrides: Parameters<typeof createStoreSnapshot>[0] = {}) {
  return createStoreSnapshot({
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
    ...overrides,
  });
}

function configureWorkspaceMocks(draftForm = createDraftInput()) {
  const setDraftForm = vi.fn();

  mockState.persistenceOptions = [];
  mockState.createDetailedRunner.mockReset();
  mockState.createDetailedRunner.mockReturnValue(null);
  mockState.renderIssues = [];
  mockState.persistenceState = {
    createDraft: vi.fn(),
    deleteDraft: vi.fn(),
    draftAutoSaveState: "saved",
    draftForm,
    duplicateDraft: vi.fn(),
    flushPendingDraft: vi.fn(),
    hydrateSnapshot: vi.fn(),
    openDraftById: vi.fn(),
    openDraftInput: vi.fn(),
    restoreDraftHistory: vi.fn(),
    saveDraft: vi.fn(),
    selectDraft: vi.fn(),
    selectedDraftId: draftForm.id,
    setDraftForm,
    toggleDraftPinned: vi.fn(),
  };
  mockState.variablePresetState = {
    applyVariablePreset: vi.fn(),
    canApplyVariablePreset: false,
    canSaveVariablePreset: false,
    changeVariablePresetName: vi.fn(),
    createVariablePreset: vi.fn(),
    deleteVariablePreset: vi.fn(),
    resetVariablePresetSelection: vi.fn(),
    saveVariablePreset: vi.fn(),
    selectVariablePreset: vi.fn(),
    selectedVariablePresetId: null,
    variablePresetName: "",
  };

  return { setDraftForm };
}

function createStateOptions(
  overrides: Partial<Parameters<typeof useDraftWorkspaceState>[0]> = {},
): Parameters<typeof useDraftWorkspaceState>[0] {
  return {
    disabledRuleIds: [],
    onClearError: vi.fn(),
    onDisableProofreadingRule: vi.fn(async () => {}),
    onError: vi.fn(),
    onNotice: vi.fn(),
    onOpenTemplateInput: vi.fn(),
    onSnapshotChange: vi.fn(),
    snapshot: createCleanSnapshot(),
    ...overrides,
  };
}

describe("useDraftWorkspaceState general", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: class WorkerMock {},
    });
    configureWorkspaceMocks();
  });

  afterEach(() => {
    if (originalWorker === undefined) {
      delete (globalThis as { Worker?: typeof Worker }).Worker;
    } else {
      Object.defineProperty(globalThis, "Worker", {
        configurable: true,
        writable: true,
        value: originalWorker,
      });
    }
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("sanitizes stale template and signature ids that no longer exist anywhere", () => {
    const draftForm = createDraftInput({
      id: "draft-stale",
      templateId: "template-missing",
      signatureId: "signature-missing",
    });
    const { setDraftForm } = configureWorkspaceMocks(draftForm);

    renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          snapshot: createCleanSnapshot({
            drafts: [createDraft({ id: "draft-stale", templateId: null, signatureId: null })],
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
            templates: [createTemplate({ id: "template-active" })],
          }),
        }),
      ),
    );

    const updater = setDraftForm.mock.calls[setDraftForm.mock.calls.length - 1]?.[0] as
      | ((input: typeof draftForm) => typeof draftForm)
      | undefined;
    expect(updater).toBeTypeOf("function");
    if (!updater) {
      throw new Error("expected sanitizing draft form updater");
    }
    expect(updater(draftForm)).toMatchObject({
      templateId: null,
      signatureId: "signature-default",
    });
  });

  it("keeps template and signature ids when they still exist in trash", () => {
    const draftForm = createDraftInput({
      id: "draft-trash",
      templateId: "template-trash",
      signatureId: "signature-trash",
    });
    const { setDraftForm } = configureWorkspaceMocks(draftForm);

    renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          snapshot: createCleanSnapshot({
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
            templates: [createTemplate({ id: "template-active" })],
            trash: {
              drafts: [],
              templates: [{ template: createTemplate({ id: "template-trash" }), deletedAt: "10" }],
              signatures: [
                {
                  signature: createSignature({ id: "signature-trash", isDefault: false }),
                  deletedAt: "11",
                },
              ],
              memos: [],
            },
          }),
        }),
      ),
    );

    const updater = setDraftForm.mock.calls[setDraftForm.mock.calls.length - 1]?.[0] as
      | ((input: typeof draftForm) => typeof draftForm)
      | undefined;
    expect(updater).toBeTypeOf("function");
    if (!updater) {
      throw new Error("expected preserving draft form updater");
    }
    expect(updater(draftForm)).toMatchObject({
      templateId: "template-trash",
      signatureId: "signature-trash",
    });
  });

  it("applies a template without discarding variable values or an explicit title", () => {
    const draftForm = createDraftInput({
      body: "古い本文",
      id: "draft-apply",
      signatureId: "signature-default",
      subject: "古い件名",
      templateId: null,
      title: "既存タイトル",
      variableValues: { 相手名: "佐藤様" },
    });
    const { setDraftForm } = configureWorkspaceMocks(draftForm);
    const onNotice = vi.fn();

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          onError: vi.fn(),
          onNotice,
          snapshot: createCleanSnapshot({
            signatures: [
              createSignature({ id: "signature-default", isDefault: true }),
              createSignature({ id: "signature-alt", isDefault: false }),
            ],
            templates: [
              createTemplate({
                body: "新しい本文",
                id: "template-next",
                name: "提案テンプレート",
                signatureId: "signature-alt",
                subject: "新しい件名",
              }),
            ],
          }),
        }),
      ),
    );

    setDraftForm.mockClear();

    act(() => {
      result.current.workspaceProps.onApplyTemplate("template-next");
    });

    const updater = setDraftForm.mock.calls[0]?.[0] as (
      input: typeof draftForm,
    ) => typeof draftForm;
    expect(updater(draftForm)).toMatchObject({
      body: "新しい本文",
      signatureId: "signature-alt",
      subject: "新しい件名",
      templateId: "template-next",
      title: "既存タイトル",
      variableValues: { 相手名: "佐藤様" },
    });
    expect(onNotice).toHaveBeenCalledWith(
      "テンプレート「提案テンプレート」を下書きに反映しました。",
    );
  });

  it("updates tags through the shared draft change handler", () => {
    const draftForm = createDraftInput({
      id: "draft-tags",
      tags: [],
    });
    const { setDraftForm } = configureWorkspaceMocks(draftForm);

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          snapshot: createCleanSnapshot({
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
          }),
        }),
      ),
    );

    setDraftForm.mockClear();

    act(() => {
      result.current.workspaceProps.onChangeDraft("tags", ["社外", "営業"]);
    });

    const updater = setDraftForm.mock.calls[0]?.[0] as (
      input: typeof draftForm,
    ) => typeof draftForm;
    expect(updater(draftForm)).toMatchObject({
      tags: ["社外", "営業"],
    });
  });

  it("opens a new template from the current draft after flushing pending auto-save work", () => {
    const draftForm = createDraftInput({
      body: "提案内容です。",
      id: "draft-to-template",
      opening: "いつもお世話になっております。",
      subject: "次回提案のご案内",
      tags: ["社外", "営業"],
      title: "営業フォロー",
    });
    configureWorkspaceMocks(draftForm);
    const onOpenTemplateInput = vi.fn();

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          onOpenTemplateInput,
          snapshot: createCleanSnapshot({
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
          }),
        }),
      ),
    );

    act(() => {
      result.current.workspaceProps.onCreateTemplateFromDraft();
    });

    expect(mockState.persistenceState.flushPendingDraft).toHaveBeenCalledTimes(1);
    expect(onOpenTemplateInput).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "営業フォロー",
        subject: "次回提案のご案内",
        body: "提案内容です。",
        signatureId: "signature-1",
        tags: ["社外", "営業"],
      }),
    );
    expect(result.current.workspaceProps.canCreateTemplate).toBe(true);
  });

  it("copies the rendered preview and reports both success and failure paths", async () => {
    const draftForm = createDraftInput({
      id: "draft-copy",
      signatureId: "signature-default",
    });
    configureWorkspaceMocks(draftForm);
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();

    mockState.copyPlainText.mockResolvedValueOnce(undefined).mockRejectedValueOnce("コピー失敗");

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          onClearError,
          onError,
          onNotice,
          snapshot: createCleanSnapshot({
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
          }),
        }),
      ),
    );

    await act(async () => {
      await result.current.handle.copyPreview();
    });

    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(mockState.copyPlainText).toHaveBeenCalledWith("rendered preview");
    expect(onNotice).toHaveBeenCalledWith("プレーンテキストの本文をコピーしました。");

    await act(async () => {
      await result.current.workspaceProps.onCopyPreview();
    });

    expect(onError).toHaveBeenCalledWith("コピー失敗");
  });

  it("filters drafts from the current snapshot by deferred search tokens and sort order", async () => {
    configureWorkspaceMocks(
      createDraftInput({
        id: "draft-selected",
        title: "選択中",
      }),
    );

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          snapshot: createCleanSnapshot({
            drafts: [
              createDraft({
                body: "候補本文",
                id: "draft-b",
                tags: ["社外"],
                title: "Beta",
                updatedAt: "20",
                variableValues: { 会社名: "候補株式会社" },
              }),
              createDraft({
                body: "別本文",
                id: "draft-a",
                tags: ["社内"],
                title: "Alpha",
                updatedAt: "10",
                variableValues: { 会社名: "別会社" },
              }),
            ],
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
          }),
        }),
      ),
    );

    act(() => {
      result.current.workspaceProps.onChangeSearchQuery("候補");
      result.current.workspaceProps.onChangeSort("label");
    });

    await waitFor(() => {
      expect(result.current.workspaceProps.drafts.map((draft) => draft.id)).toEqual(["draft-b"]);
    });
    expect(result.current.workspaceProps.searchQuery).toBe("候補");
    expect(result.current.workspaceProps.sort).toBe("label");
    expect(result.current.workspaceProps.totalDraftCount).toBe(2);

    act(() => {
      result.current.workspaceProps.onChangeSearchQuery("");
      result.current.workspaceProps.onChangeTagFilter("社内");
    });

    await waitFor(() => {
      expect(result.current.workspaceProps.drafts.map((draft) => draft.id)).toEqual(["draft-a"]);
    });
    expect(result.current.workspaceProps.activeTagFilter).toBe("社内");
    expect(result.current.workspaceProps.availableTags).toEqual(["社外", "社内"]);
  });

  it("clears an active tag filter when the next snapshot no longer exposes that tag", () => {
    configureWorkspaceMocks(
      createDraftInput({
        id: "draft-selected",
        title: "選択中",
      }),
    );

    const initialSnapshot = createCleanSnapshot({
      drafts: [
        createDraft({
          id: "draft-a",
          tags: ["社外"],
          title: "Alpha",
        }),
      ],
      signatures: [createSignature({ id: "signature-default", isDefault: true })],
    });
    const nextSnapshot = createCleanSnapshot({
      drafts: [
        createDraft({
          id: "draft-b",
          tags: ["社内"],
          title: "Beta",
        }),
      ],
      signatures: [createSignature({ id: "signature-default", isDefault: true })],
    });

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: ReturnType<typeof createCleanSnapshot> }) =>
        useDraftWorkspaceState(
          createStateOptions({
            snapshot,
          }),
        ),
      {
        initialProps: {
          snapshot: initialSnapshot,
        },
      },
    );

    act(() => {
      result.current.workspaceProps.onChangeTagFilter("社外");
    });

    expect(result.current.workspaceProps.activeTagFilter).toBe("社外");

    rerender({ snapshot: nextSnapshot });

    expect(result.current.workspaceProps.activeTagFilter).toBeNull();
    expect(result.current.workspaceProps.availableTags).toEqual(["社内"]);
  });
});

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

const DETAIL_TEST_DEBOUNCE_MS = 700;
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
    onSnapshotChange: vi.fn(),
    snapshot: createCleanSnapshot(),
    ...overrides,
  };
}

describe("draft workspace state", () => {
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
      id: "draft-apply",
      title: "既存タイトル",
      subject: "古い件名",
      body: "古い本文",
      templateId: null,
      signatureId: "signature-default",
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
            templates: [
              createTemplate({
                id: "template-next",
                name: "提案テンプレート",
                subject: "新しい件名",
                body: "新しい本文",
                signatureId: "signature-alt",
              }),
            ],
            signatures: [
              createSignature({ id: "signature-default", isDefault: true }),
              createSignature({ id: "signature-alt", isDefault: false }),
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
      title: "既存タイトル",
      subject: "新しい件名",
      body: "新しい本文",
      templateId: "template-next",
      signatureId: "signature-alt",
      variableValues: { 相手名: "佐藤様" },
    });
    expect(onNotice).toHaveBeenCalledWith(
      "テンプレート「提案テンプレート」を下書きに反映しました。",
    );
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
                id: "draft-b",
                title: "Beta",
                body: "候補本文",
                updatedAt: "20",
                variableValues: { 会社名: "候補株式会社" },
              }),
              createDraft({
                id: "draft-a",
                title: "Alpha",
                body: "別本文",
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
  });

  it("ignores a proofreading issue once for the current draft", () => {
    configureWorkspaceMocks();
    mockState.renderIssues = [
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "issue-1",
        ruleId: "discouraged.understood",
        severity: "warning",
        title: "非推奨表現の可能性があります。",
      },
    ];

    const { result } = renderHook(() => useDraftWorkspaceState(createStateOptions()));

    expect(result.current.workspaceProps.issues).toHaveLength(1);

    act(() => {
      result.current.workspaceProps.onIgnoreIssue("issue-1");
    });

    expect(result.current.workspaceProps.issues).toEqual([]);
  });

  it("applies an issue suggestion back into the draft form", () => {
    const draftForm = createDraftInput({
      body: "了解しました。",
    });
    const { setDraftForm } = configureWorkspaceMocks(draftForm);
    const onNotice = vi.fn();
    mockState.renderIssues = [
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "issue-1",
        ruleId: "discouraged.understood",
        severity: "warning",
        suggestion: {
          edits: [
            {
              field: "body",
              from: 0,
              originalText: "了解しました",
              replacement: "承知しました",
              to: 6,
            },
          ],
          label: "言い換える",
        },
        title: "非推奨表現の可能性があります。",
      },
    ];

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          onError: vi.fn(),
          onNotice,
        }),
      ),
    );

    setDraftForm.mockClear();

    act(() => {
      result.current.workspaceProps.onApplyIssueSuggestion("issue-1");
    });

    const updater = setDraftForm.mock.calls[0]?.[0] as (
      input: typeof draftForm,
    ) => typeof draftForm;

    expect(updater(draftForm).body).toBe("承知しました。");
    expect(onNotice).toHaveBeenCalledWith("非推奨表現の可能性があります。 の候補を適用しました。");
  });

  it("filters issues whose rule ids are disabled in settings", () => {
    configureWorkspaceMocks();
    mockState.renderIssues = [
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "issue-1",
        ruleId: "discouraged.understood",
        severity: "warning",
        title: "非推奨表現の可能性があります。",
      },
    ];

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          disabledRuleIds: ["discouraged.understood"],
        }),
      ),
    );

    expect(result.current.workspaceProps.issues).toEqual([]);
  });

  it("delegates proofreading rule disable requests to settings state", async () => {
    configureWorkspaceMocks();
    const onDisableProofreadingRule = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          onDisableProofreadingRule,
        }),
      ),
    );

    await act(async () => {
      await result.current.workspaceProps.onDisableIssueRule("whitespace.trailing");
    });

    expect(onDisableProofreadingRule).toHaveBeenCalledWith("whitespace.trailing");
  });

  it("runs detailed proofreading after input settles and merges duplicate issues", async () => {
    vi.useFakeTimers();
    const draftForm = createDraftInput({
      body: "了解しました。",
      signatureId: "signature-default",
    });
    configureWorkspaceMocks(draftForm);
    mockState.renderIssues = [
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "issue-1",
        ruleId: "discouraged.understood",
        severity: "warning",
        suggestion: {
          edits: [
            {
              field: "body",
              from: 0,
              originalText: "了解しました",
              replacement: "承知しました",
              to: 6,
            },
          ],
          label: "候補を適用",
        },
        title: "非推奨表現の可能性があります。",
      },
    ];
    const run = vi.fn().mockResolvedValue([
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "issue-2",
        ruleId: "prh",
        severity: "warning",
        suggestion: {
          edits: [
            {
              field: "body",
              from: 0,
              originalText: "了解しました",
              replacement: "承知しました",
              to: 6,
            },
          ],
          label: "候補を適用",
        },
        title: "非推奨表現の可能性があります。",
      },
    ]);
    const dispose = vi.fn();
    mockState.createDetailedRunner.mockReturnValue({ dispose, run });

    const { result, unmount } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          snapshot: createCleanSnapshot({
            signatures: [createSignature({ id: "signature-default", isDefault: true })],
          }),
        }),
      ),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DETAIL_TEST_DEBOUNCE_MS);
    });

    expect(run).toHaveBeenCalledWith({
      draft: draftForm,
    });
    expect(result.current.workspaceProps.issues).toHaveLength(1);
    expect(result.current.workspaceProps.detailedCheckStatus).toBe("ready");

    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it("does not rerun detailed proofreading when only the selected signature body changes", async () => {
    vi.useFakeTimers();
    const draftForm = createDraftInput({
      body: "本文です。",
      signatureId: "signature-default",
    });
    configureWorkspaceMocks(draftForm);
    const run = vi.fn().mockResolvedValue([]);
    mockState.createDetailedRunner.mockReturnValue({
      dispose: vi.fn(),
      run,
    });

    const initialSnapshot = createCleanSnapshot({
      signatures: [
        createSignature({
          body: "株式会社△△\n田中 太郎",
          id: "signature-default",
          isDefault: true,
        }),
      ],
    });
    const updatedSnapshot = createCleanSnapshot({
      signatures: [
        createSignature({
          body: "株式会社△△\n佐藤 花子",
          id: "signature-default",
          isDefault: true,
        }),
      ],
    });

    const { rerender } = renderHook(
      ({ snapshot }) =>
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DETAIL_TEST_DEBOUNCE_MS);
    });

    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();

    rerender({
      snapshot: updatedSnapshot,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DETAIL_TEST_DEBOUNCE_MS);
    });

    expect(run).not.toHaveBeenCalled();
  });

  it("applies a detailed issue suggestion back into the draft form", async () => {
    const draftForm = createDraftInput({
      body: "了解しました。",
    });
    const { setDraftForm } = configureWorkspaceMocks(draftForm);
    const onNotice = vi.fn();
    const run = vi.fn().mockResolvedValue([
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "detail-issue-1",
        ruleId: "prh",
        severity: "warning",
        suggestion: {
          edits: [
            {
              field: "body",
              from: 0,
              originalText: "了解しました",
              replacement: "承知しました",
              to: 6,
            },
          ],
          label: "候補を適用",
        },
        title: "非推奨表現の可能性があります。",
      },
    ]);
    mockState.createDetailedRunner.mockReturnValue({
      dispose: vi.fn(),
      run,
    });

    const { result } = renderHook(() =>
      useDraftWorkspaceState(
        createStateOptions({
          onError: vi.fn(),
          onNotice,
        }),
      ),
    );

    await act(async () => {
      result.current.workspaceProps.onRunDetailedCheck();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.workspaceProps.issues).toHaveLength(1);

    setDraftForm.mockClear();

    act(() => {
      result.current.workspaceProps.onApplyIssueSuggestion("detail-issue-1");
    });

    const updater = setDraftForm.mock.calls[0]?.[0] as (
      input: typeof draftForm,
    ) => typeof draftForm;

    expect(updater(draftForm).body).toBe("承知しました。");
    expect(onNotice).toHaveBeenCalledWith("非推奨表現の可能性があります。 の候補を適用しました。");
  });

  it("surfaces the detailed proofreading error message in the status label", async () => {
    configureWorkspaceMocks();
    mockState.createDetailedRunner.mockReturnValue({
      dispose: vi.fn(),
      run: vi.fn().mockRejectedValue(new Error("Failed to fetch dynamically imported module.")),
    });

    const { result } = renderHook(() => useDraftWorkspaceState(createStateOptions()));

    await act(async () => {
      result.current.workspaceProps.onRunDetailedCheck();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.workspaceProps.detailedCheckStatus).toBe("error");
    expect(result.current.workspaceProps.detailedCheckStatusLabel).toContain(
      "Failed to fetch dynamically imported module.",
    );
  });

  it("does not crash when the detailed proofreading worker fails during initialization", async () => {
    configureWorkspaceMocks();
    mockState.createDetailedRunner.mockImplementation(() => {
      throw new Error("Failed to construct Worker.");
    });

    const { result } = renderHook(() => useDraftWorkspaceState(createStateOptions()));

    await act(async () => {
      result.current.workspaceProps.onRunDetailedCheck();
      await Promise.resolve();
    });

    expect(result.current.workspaceProps.detailedCheckStatus).toBe("error");
    expect(result.current.workspaceProps.detailedCheckStatusLabel).toContain(
      "Failed to construct Worker.",
    );
  });
});

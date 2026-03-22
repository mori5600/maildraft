import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDraftInput, createSignature, createStoreSnapshot } from "../../../test/ui-fixtures";
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

describe("useDraftWorkspaceState proofreading", () => {
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

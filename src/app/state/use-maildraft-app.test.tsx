import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDraftInput,
  createEditorSettingsSnapshot,
  createLoggingSettingsSnapshot,
  createMemoInput,
  createProofreadingSettingsSnapshot,
  createSignature,
  createStoreSnapshot,
  createTemplate,
} from "../../test/ui-fixtures";

const mockState = vi.hoisted(() => ({
  memoCreate: vi.fn(),
  memoFlush: vi.fn(),
  memoHydrate: vi.fn(),
  memoSave: vi.fn(async () => {}),
  memoTogglePinned: vi.fn(),
  templateCreate: vi.fn(),
  templateFlush: vi.fn(),
  templateHydrate: vi.fn(),
  templateSave: vi.fn(async () => {}),
  templateSyncSignatureId: vi.fn(),
  templateTogglePinned: vi.fn(),
  signatureCreate: vi.fn(),
  signatureFlush: vi.fn(),
  signatureHydrate: vi.fn(),
  signatureSave: vi.fn(async () => {}),
  signatureTogglePinned: vi.fn(),
  settingsHydrateEditor: vi.fn(),
  settingsHydrateLogging: vi.fn(),
  settingsHydrateProofreading: vi.fn(),
  settingsDisableProofreadingRule: vi.fn(async () => {}),
  settingsSaveSettingsSection: vi.fn(async () => {}),
  memoOptions: [] as Array<{
    onOpenDraftInput: (input: ReturnType<typeof createDraftInput>) => void;
    onSnapshotChange: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onTrashItemSelect: (key: string | null) => void;
    onViewChange: (view: string) => void;
  }>,
  settingsOptions: [] as Array<{
    onBackupImported: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
  }>,
  signatureOptions: [] as Array<{
    onFlushDraft: () => void;
    onTrashItemSelect: (key: string | null) => void;
    onViewChange: (view: string) => void;
  }>,
  bootstrapOptions: [] as Array<{
    hydrateEditorSettings: (settings: ReturnType<typeof createEditorSettingsSnapshot>) => void;
    hydrateLoggingSettings: (settings: ReturnType<typeof createLoggingSettingsSnapshot>) => void;
    hydrateProofreadingSettings: (
      settings: ReturnType<typeof createProofreadingSettingsSnapshot>,
    ) => void;
    hydrateSnapshot: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onClearError: () => void;
    onError: (message: string) => void;
    onLoadingChange: (isLoading: boolean) => void;
    onNotice: (message: string) => void;
    onWarning: (message: string) => void;
  }>,
  shortcutOptions: [] as Array<{
    actions: {
      changeView: (view: string) => void;
      copyDraftPreview: () => Promise<void>;
      createDraft: () => void;
      createMemo: () => void;
      createSignature: () => void;
      createTemplate: () => void;
      saveDraft: () => Promise<void>;
      saveSettingsSection: () => Promise<void>;
      saveMemo: () => Promise<void>;
      saveSignature: () => Promise<void>;
      saveTemplate: () => Promise<void>;
      toggleDraftPinned: () => void;
      toggleMemoPinned: () => void;
      toggleSignaturePinned: () => void;
      toggleTemplatePinned: () => void;
    };
  }>,
  templateOptions: [] as Array<{
    onFlushDraft: () => void;
    onOpenDraftInput: (input: ReturnType<typeof createDraftInput>) => void;
    onTrashItemSelect: (key: string | null) => void;
    onViewChange: (view: string) => void;
  }>,
  trashOptions: [] as Array<{
    onDraftRestored: (draftId: string, snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onMemoRestored: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onSignatureRestored: (
      snapshot: ReturnType<typeof createStoreSnapshot>,
      signatureId: string,
    ) => void;
    onTemplateRestored: (
      snapshot: ReturnType<typeof createStoreSnapshot>,
      templateId: string,
    ) => void;
    onTrashSelectionChange: (key: string | null) => void;
  }>,
  trashItems: [{ key: "draft:draft-1" }],
}));

vi.mock("../../modules/memo/state/use-memo-workspace-state", () => ({
  useMemoWorkspaceState: (options: {
    onOpenDraftInput: (input: ReturnType<typeof createDraftInput>) => void;
    onSnapshotChange: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onTrashItemSelect: (key: string | null) => void;
    onViewChange: (view: string) => void;
  }) => {
    mockState.memoOptions.push(options);
    return {
      createMemo: mockState.memoCreate,
      flushPendingMemo: mockState.memoFlush,
      hydrateMemoState: mockState.memoHydrate,
      memoWorkspaceProps: {
        activeMemoUpdatedAt: null,
        autoSaveLabel: "自動保存待機中",
        availableSortOptions: [{ value: "recent", label: "更新順" }],
        canStartDraftFromMemo: false,
        memos: [],
        memoForm: createMemoInput(),
        onChangeMemo: vi.fn(),
        onChangeSearchQuery: vi.fn(),
        onChangeSort: vi.fn(),
        onCreateMemo: mockState.memoCreate,
        onDeleteMemo: vi.fn(async () => {}),
        onSaveMemo: mockState.memoSave,
        onSelectMemo: vi.fn(),
        onTogglePinned: mockState.memoTogglePinned,
        onStartDraftFromMemo: vi.fn(),
        searchQuery: "",
        selectedMemoId: null,
        showWhitespace: false,
        sort: "recent",
        totalMemoCount: 0,
      },
      saveMemo: mockState.memoSave,
      toggleMemoPinned: mockState.memoTogglePinned,
    };
  },
}));

vi.mock("../../modules/templates/state/use-template-workspace-state", () => ({
  useTemplateWorkspaceState: (options: {
    onFlushDraft: () => void;
    onOpenDraftInput: (input: ReturnType<typeof createDraftInput>) => void;
    onTrashItemSelect: (key: string | null) => void;
    onViewChange: (view: string) => void;
  }) => {
    mockState.templateOptions.push(options);
    return {
      createTemplate: mockState.templateCreate,
      flushPendingTemplate: mockState.templateFlush,
      hydrateTemplateState: mockState.templateHydrate,
      saveTemplate: mockState.templateSave,
      syncTemplateSignatureId: mockState.templateSyncSignatureId,
      templateWorkspaceProps: {
        autoSaveLabel: "自動保存待機中",
        canDuplicate: false,
        previewText: "",
        searchQuery: "",
        selectedTemplateId: null,
        showWhitespace: false,
        signatures: [],
        sort: "recent",
        templateForm: createTemplate({ id: "template-form" }),
        templates: [],
        totalTemplateCount: 0,
        onChangeSearchQuery: vi.fn(),
        onChangeSort: vi.fn(),
        onChangeTemplate: vi.fn(),
        onCreateTemplate: mockState.templateCreate,
        onDeleteTemplate: vi.fn(async () => {}),
        onDuplicateTemplate: vi.fn(async () => {}),
        onSaveTemplate: mockState.templateSave,
        onSelectTemplate: vi.fn(),
        onStartDraftFromTemplate: vi.fn(),
        onTogglePinned: mockState.templateTogglePinned,
      },
      toggleTemplatePinned: mockState.templateTogglePinned,
    };
  },
}));

vi.mock("../../modules/signatures/state/use-signature-workspace-state", () => ({
  useSignatureWorkspaceState: (options: {
    onFlushDraft: () => void;
    onTrashItemSelect: (key: string | null) => void;
    onViewChange: (view: string) => void;
  }) => {
    mockState.signatureOptions.push(options);
    return {
      createSignature: mockState.signatureCreate,
      flushPendingSignature: mockState.signatureFlush,
      hydrateSignatureState: mockState.signatureHydrate,
      saveSignature: mockState.signatureSave,
      signatureWorkspaceProps: {
        autoSaveLabel: "自動保存待機中",
        canDuplicate: false,
        searchQuery: "",
        selectedSignatureId: null,
        showWhitespace: false,
        signatureForm: {
          id: "signature-form",
          name: "署名",
          isPinned: false,
          body: "本文",
          isDefault: false,
        },
        signatures: [],
        sort: "recent",
        totalSignatureCount: 0,
        onChangeSearchQuery: vi.fn(),
        onChangeSignature: vi.fn(),
        onChangeSort: vi.fn(),
        onCreateSignature: mockState.signatureCreate,
        onDeleteSignature: vi.fn(async () => {}),
        onDuplicateSignature: vi.fn(async () => {}),
        onSaveSignature: mockState.signatureSave,
        onSelectSignature: vi.fn(),
        onTogglePinned: mockState.signatureTogglePinned,
      },
      toggleSignaturePinned: mockState.signatureTogglePinned,
    };
  },
}));

vi.mock("../../modules/settings/state/use-settings-workspace-state", () => ({
  useSettingsWorkspaceState: (options: {
    onBackupImported: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
  }) => {
    mockState.settingsOptions.push(options);
    return {
      disableProofreadingRule: mockState.settingsDisableProofreadingRule,
      hydrateEditorSettings: mockState.settingsHydrateEditor,
      hydrateLoggingSettings: mockState.settingsHydrateLogging,
      hydrateProofreadingSettings: mockState.settingsHydrateProofreading,
      saveLoggingSettings: vi.fn(async () => {}),
      saveSettingsSection: mockState.settingsSaveSettingsSection,
      settingsWorkspaceProps: {
        editorSettings: createEditorSettingsSnapshot(),
        loggingSettings: createLoggingSettingsSnapshot(),
        proofreadingSettings: createProofreadingSettingsSnapshot({
          disabledRuleIds: ["prh"],
        }),
      },
    };
  },
}));

vi.mock("../../modules/trash/state/use-trash-workspace-state", () => ({
  useTrashWorkspaceState: (options: {
    onDraftRestored: (draftId: string, snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onMemoRestored: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onSignatureRestored: (
      snapshot: ReturnType<typeof createStoreSnapshot>,
      signatureId: string,
    ) => void;
    onTemplateRestored: (
      snapshot: ReturnType<typeof createStoreSnapshot>,
      templateId: string,
    ) => void;
    onTrashSelectionChange: (key: string | null) => void;
    selectedTrashItemKey: string | null;
  }) => {
    mockState.trashOptions.push(options);
    return {
      trashItems: mockState.trashItems,
      trashWorkspaceProps: {
        items: mockState.trashItems,
        selectedItemKey: options.selectedTrashItemKey,
        showWhitespace: false,
      },
    };
  },
}));

vi.mock("./use-app-bootstrap", () => ({
  useAppBootstrap: (options: {
    hydrateEditorSettings: (settings: ReturnType<typeof createEditorSettingsSnapshot>) => void;
    hydrateLoggingSettings: (settings: ReturnType<typeof createLoggingSettingsSnapshot>) => void;
    hydrateProofreadingSettings: (
      settings: ReturnType<typeof createProofreadingSettingsSnapshot>,
    ) => void;
    hydrateSnapshot: (snapshot: ReturnType<typeof createStoreSnapshot>) => void;
    onClearError: () => void;
    onError: (message: string) => void;
    onLoadingChange: (isLoading: boolean) => void;
    onNotice: (message: string) => void;
    onWarning: (message: string) => void;
  }) => {
    mockState.bootstrapOptions.push(options);
  },
}));

vi.mock("./use-app-shortcuts", () => ({
  useAppShortcuts: (options: {
    actions: {
      changeView: (view: string) => void;
      copyDraftPreview: () => Promise<void>;
      createDraft: () => void;
      createMemo: () => void;
      createSignature: () => void;
      createTemplate: () => void;
      saveDraft: () => Promise<void>;
      saveSettingsSection: () => Promise<void>;
      saveMemo: () => Promise<void>;
      saveSignature: () => Promise<void>;
      saveTemplate: () => Promise<void>;
      toggleDraftPinned: () => void;
      toggleMemoPinned: () => void;
      toggleSignaturePinned: () => void;
      toggleTemplatePinned: () => void;
    };
  }) => {
    mockState.shortcutOptions.push(options);
  },
}));

import { useMaildraftApp } from "./use-maildraft-app";

describe("useMaildraftApp", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockState.bootstrapOptions.length = 0;
    mockState.memoOptions.length = 0;
    mockState.settingsOptions.length = 0;
    mockState.signatureOptions.length = 0;
    mockState.shortcutOptions.length = 0;
    mockState.templateOptions.length = 0;
    mockState.trashOptions.length = 0;
  });

  it("flushes workspace state when changing views and propagates shell toggles", () => {
    const draftWorkspaceRef = {
      current: {
        copyPreview: vi.fn(async () => {}),
        createDraft: vi.fn(),
        flushPendingDraft: vi.fn(),
        hydrateSnapshot: vi.fn(),
        openDraftById: vi.fn(),
        openDraftInput: vi.fn(),
        saveDraft: vi.fn(async () => {}),
        togglePinned: vi.fn(),
      },
    };

    const { result } = renderHook(() => useMaildraftApp(draftWorkspaceRef));

    act(() => {
      result.current.setView("templates");
    });
    expect(draftWorkspaceRef.current.flushPendingDraft).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setView("signatures");
    });
    expect(mockState.templateFlush).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setView("memo");
    });
    expect(mockState.signatureFlush).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setView("drafts");
    });
    expect(mockState.memoFlush).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe("drafts");

    act(() => {
      result.current.toggleWhitespace();
    });
    expect(result.current.showWhitespace).toBe(true);
    expect(result.current.memoWorkspaceProps.showWhitespace).toBe(true);
    expect(result.current.templateWorkspaceProps.showWhitespace).toBe(true);
    expect(result.current.signatureWorkspaceProps.showWhitespace).toBe(true);
    expect(result.current.trashWorkspaceProps.showWhitespace).toBe(true);
    expect(result.current.draftWorkspaceProps.editorSettings).toMatchObject({
      indentStyle: "spaces",
      tabSize: 2,
    });
    expect(result.current.memoWorkspaceProps.editorSettings).toMatchObject({
      indentStyle: "spaces",
      tabSize: 2,
    });
    expect(result.current.templateWorkspaceProps.editorSettings).toMatchObject({
      indentStyle: "spaces",
      tabSize: 2,
    });
    expect(result.current.signatureWorkspaceProps.editorSettings).toMatchObject({
      indentStyle: "spaces",
      tabSize: 2,
    });
    expect(result.current.draftWorkspaceProps.disabledProofreadingRuleIds).toEqual(["prh"]);

    act(() => {
      mockState.shortcutOptions[mockState.shortcutOptions.length - 1]?.actions.createDraft();
    });
    expect(draftWorkspaceRef.current.createDraft).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe("drafts");
  });

  it("rehydrates dependent workspace state after backup import", () => {
    const draftWorkspaceRef = {
      current: {
        copyPreview: vi.fn(async () => {}),
        createDraft: vi.fn(),
        flushPendingDraft: vi.fn(),
        hydrateSnapshot: vi.fn(),
        openDraftById: vi.fn(),
        openDraftInput: vi.fn(),
        saveDraft: vi.fn(async () => {}),
        togglePinned: vi.fn(),
      },
    };

    const { result } = renderHook(() => useMaildraftApp(draftWorkspaceRef));

    const nextSnapshot = createStoreSnapshot({
      templates: [createTemplate({ id: "template-imported" })],
      signatures: [createSignature({ id: "signature-imported" })],
      trash: {
        drafts: [
          {
            draft: createStoreSnapshot().drafts[0],
            history: [],
            deletedAt: "30",
          },
        ],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    act(() => {
      mockState.settingsOptions[mockState.settingsOptions.length - 1]?.onBackupImported(
        nextSnapshot,
      );
    });

    expect(mockState.memoHydrate).toHaveBeenCalledWith(nextSnapshot);
    expect(mockState.templateHydrate).toHaveBeenCalledWith(nextSnapshot, "template-imported");
    expect(mockState.signatureHydrate).toHaveBeenCalledWith(nextSnapshot, "signature-imported");
    expect(draftWorkspaceRef.current.hydrateSnapshot).toHaveBeenCalledWith(nextSnapshot);
    expect(result.current.views.find((view) => view.id === "templates")?.count).toBe(1);
  });

  it("wires shortcut actions to workspace services and draft shell callbacks", async () => {
    const draftWorkspaceRef = {
      current: {
        copyPreview: vi.fn(async () => {}),
        createDraft: vi.fn(),
        flushPendingDraft: vi.fn(),
        hydrateSnapshot: vi.fn(),
        openDraftById: vi.fn(),
        openDraftInput: vi.fn(),
        saveDraft: vi.fn(async () => {}),
        togglePinned: vi.fn(),
      },
    };

    const { result } = renderHook(() => useMaildraftApp(draftWorkspaceRef));
    const actions = mockState.shortcutOptions[mockState.shortcutOptions.length - 1]?.actions;

    await act(async () => {
      await actions?.copyDraftPreview();
      actions?.createMemo();
      actions?.createSignature();
      actions?.createTemplate();
      await actions?.saveDraft();
      await actions?.saveSettingsSection();
      await actions?.saveMemo();
      await actions?.saveSignature();
      await actions?.saveTemplate();
      actions?.toggleDraftPinned();
      actions?.toggleMemoPinned();
      actions?.toggleSignaturePinned();
      actions?.toggleTemplatePinned();
    });

    expect(draftWorkspaceRef.current.copyPreview).toHaveBeenCalledTimes(1);
    expect(mockState.memoCreate).toHaveBeenCalledTimes(1);
    expect(mockState.signatureCreate).toHaveBeenCalledTimes(1);
    expect(mockState.templateCreate).toHaveBeenCalledTimes(1);
    expect(draftWorkspaceRef.current.saveDraft).toHaveBeenCalledTimes(1);
    expect(mockState.settingsSaveSettingsSection).toHaveBeenCalledTimes(1);
    expect(mockState.memoSave).toHaveBeenCalledTimes(1);
    expect(mockState.signatureSave).toHaveBeenCalledTimes(1);
    expect(mockState.templateSave).toHaveBeenCalledTimes(1);
    expect(draftWorkspaceRef.current.togglePinned).toHaveBeenCalledTimes(1);
    expect(mockState.memoTogglePinned).toHaveBeenCalledTimes(1);
    expect(mockState.signatureTogglePinned).toHaveBeenCalledTimes(1);
    expect(mockState.templateTogglePinned).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.draftWorkspaceProps.onError("下書きエラー");
    });
    expect(result.current.error).toBe("下書きエラー");

    act(() => {
      result.current.draftWorkspaceProps.onNotice("下書き通知");
    });
    expect(result.current.notice).toBe("下書き通知");
    act(() => {
      void result.current.draftWorkspaceProps.onDisableProofreadingRule("whitespace.trailing");
    });
    expect(mockState.settingsDisableProofreadingRule).toHaveBeenCalledWith("whitespace.trailing");

    const nextSnapshot = createStoreSnapshot({
      memos: [createStoreSnapshot().memos[0]],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    act(() => {
      result.current.draftWorkspaceProps.onSnapshotChange(nextSnapshot);
    });
    expect(result.current.draftWorkspaceProps.snapshot).toEqual(nextSnapshot);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
    expect(result.current.notice).toBe("ライト表示に切り替えました。");
  });

  it("routes workspace callback props through the shell and draft workspace handle", () => {
    const draftWorkspaceRef = {
      current: {
        copyPreview: vi.fn(async () => {}),
        createDraft: vi.fn(),
        flushPendingDraft: vi.fn(),
        hydrateSnapshot: vi.fn(),
        openDraftById: vi.fn(),
        openDraftInput: vi.fn(),
        saveDraft: vi.fn(async () => {}),
        togglePinned: vi.fn(),
      },
    };

    const { result } = renderHook(() => useMaildraftApp(draftWorkspaceRef));
    const memoOptions = mockState.memoOptions[mockState.memoOptions.length - 1];
    const templateOptions = mockState.templateOptions[mockState.templateOptions.length - 1];
    const signatureOptions = mockState.signatureOptions[mockState.signatureOptions.length - 1];
    const draftInput = createDraftInput({ id: "draft-from-callback" });
    const nextSnapshot = createStoreSnapshot({
      templates: [createTemplate({ id: "template-callback" })],
      signatures: [createSignature({ id: "signature-callback" })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    act(() => {
      memoOptions?.onOpenDraftInput(draftInput);
      memoOptions?.onSnapshotChange(nextSnapshot);
      memoOptions?.onTrashItemSelect("memo:memo-1");
      memoOptions?.onViewChange("memo");
      templateOptions?.onFlushDraft();
      templateOptions?.onOpenDraftInput(draftInput);
      templateOptions?.onViewChange("templates");
      signatureOptions?.onFlushDraft();
      signatureOptions?.onViewChange("signatures");
    });

    expect(draftWorkspaceRef.current.openDraftInput).toHaveBeenNthCalledWith(1, draftInput);
    expect(draftWorkspaceRef.current.openDraftInput).toHaveBeenNthCalledWith(2, draftInput);
    expect(draftWorkspaceRef.current.flushPendingDraft).toHaveBeenCalledTimes(2);
    expect(result.current.draftWorkspaceProps.snapshot).toEqual(nextSnapshot);
    expect(result.current.view).toBe("signatures");
    expect(result.current.trashWorkspaceProps.selectedItemKey).toBe("memo:memo-1");
    expect(result.current.views.find((view) => view.id === "templates")?.count).toBe(1);
  });

  it("applies bootstrap and trash callbacks to shell state and dependent workspaces", () => {
    const draftWorkspaceRef = {
      current: {
        copyPreview: vi.fn(async () => {}),
        createDraft: vi.fn(),
        flushPendingDraft: vi.fn(),
        hydrateSnapshot: vi.fn(),
        openDraftById: vi.fn(),
        openDraftInput: vi.fn(),
        saveDraft: vi.fn(async () => {}),
        togglePinned: vi.fn(),
      },
    };

    const { result } = renderHook(() => useMaildraftApp(draftWorkspaceRef));
    const bootstrap = mockState.bootstrapOptions[mockState.bootstrapOptions.length - 1];
    const trash = mockState.trashOptions[mockState.trashOptions.length - 1];
    const nextSnapshot = createStoreSnapshot({
      templates: [createTemplate({ id: "template-restored" })],
      signatures: [createSignature({ id: "signature-restored" })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    act(() => {
      bootstrap?.onLoadingChange(false);
      bootstrap?.onWarning("復旧しました");
      bootstrap?.onError("読み込みエラー");
      bootstrap?.onClearError();
      bootstrap?.onNotice("読み込み完了");
      bootstrap?.hydrateEditorSettings(
        createEditorSettingsSnapshot({ indentStyle: "tabs", tabSize: 4 }),
      );
      bootstrap?.hydrateLoggingSettings(createLoggingSettingsSnapshot({ mode: "standard" }));
      bootstrap?.hydrateProofreadingSettings(
        createProofreadingSettingsSnapshot({ disabledRuleIds: ["whitespace.trailing"] }),
      );
      bootstrap?.hydrateSnapshot(nextSnapshot);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.warning).toBeNull();
    expect(result.current.notice).toBe("読み込み完了");
    expect(mockState.settingsHydrateEditor).toHaveBeenCalled();
    expect(mockState.settingsHydrateLogging).toHaveBeenCalled();
    expect(mockState.settingsHydrateProofreading).toHaveBeenCalled();
    expect(mockState.memoHydrate).toHaveBeenCalledWith(nextSnapshot);
    expect(mockState.templateHydrate).toHaveBeenCalledWith(nextSnapshot, "template-restored");
    expect(mockState.signatureHydrate).toHaveBeenCalledWith(nextSnapshot, "signature-restored");

    act(() => {
      trash?.onDraftRestored("draft-9", nextSnapshot);
      trash?.onMemoRestored(nextSnapshot);
      trash?.onSignatureRestored(nextSnapshot, "signature-restored");
      trash?.onTemplateRestored(nextSnapshot, "template-restored");
      trash?.onTrashSelectionChange("memo:memo-1");
    });

    expect(draftWorkspaceRef.current.openDraftById).toHaveBeenCalledWith("draft-9", nextSnapshot);
    expect(mockState.memoHydrate).toHaveBeenCalledTimes(2);
    expect(mockState.signatureHydrate).toHaveBeenCalledWith(nextSnapshot, "signature-restored");
    expect(mockState.templateSyncSignatureId).toHaveBeenCalledWith(nextSnapshot);
    expect(mockState.templateHydrate).toHaveBeenCalledWith(nextSnapshot, "template-restored");
    expect(result.current.trashWorkspaceProps.selectedItemKey).toBe("memo:memo-1");
  });
});

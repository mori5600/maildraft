import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  createEditorSettingsSnapshot,
  createLogEntry,
  createLoggingSettingsSnapshot,
  createProofreadingSettingsSnapshot,
  createStoreSnapshot,
} from "../../../test/ui-fixtures";
import { useSettingsWorkspaceState } from "./use-settings-workspace-state";

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: confirmMock,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

describe("settings workspace state", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates and saves logging settings", async () => {
    const onBackupImported = vi.fn();
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();
    const nextLoggingSettings = createLoggingSettingsSnapshot({
      mode: "standard",
      retentionDays: 30,
      totalBytes: 4096,
      fileCount: 4,
    });

    vi.spyOn(maildraftApi, "saveLoggingSettings").mockResolvedValue(nextLoggingSettings);

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported,
        onClearError,
        onError,
        onNotice,
      }),
    );

    act(() => {
      result.current.hydrateLoggingSettings(
        createLoggingSettingsSnapshot({
          mode: "off",
          retentionDays: 7,
        }),
      );
    });

    act(() => {
      result.current.settingsWorkspaceProps.onChangeLogging("mode", "standard");
      result.current.settingsWorkspaceProps.onChangeLogging("retentionDays", 30);
    });

    await act(async () => {
      await result.current.settingsWorkspaceProps.onSaveLoggingSettings();
    });

    expect(maildraftApi.saveLoggingSettings).toHaveBeenCalledWith({
      mode: "standard",
      retentionDays: 30,
    });
    expect(result.current.settingsWorkspaceProps.loggingSettings).toMatchObject({
      mode: "standard",
      retentionDays: 30,
      totalBytes: 4096,
      fileCount: 4,
    });
    expect(result.current.settingsWorkspaceProps.loggingForm).toEqual({
      mode: "standard",
      retentionDays: 30,
    });
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("ログ設定を保存しました。");
    expect(onBackupImported).not.toHaveBeenCalled();
  });

  it("hydrates and saves editor settings", async () => {
    const onBackupImported = vi.fn();
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();
    const saveDeferred = deferred<ReturnType<typeof createEditorSettingsSnapshot>>();

    vi.spyOn(maildraftApi, "saveEditorSettings").mockReturnValue(saveDeferred.promise);

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported,
        onClearError,
        onError,
        onNotice,
      }),
    );

    act(() => {
      result.current.hydrateEditorSettings(
        createEditorSettingsSnapshot({
          indentStyle: "spaces",
          tabSize: 2,
        }),
      );
    });

    act(() => {
      result.current.settingsWorkspaceProps.onChangeEditor("indentStyle", "tabs");
      result.current.settingsWorkspaceProps.onChangeEditor("tabSize", 4);
    });

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.settingsWorkspaceProps.onSaveEditorSettings();
    });

    await waitFor(() => {
      expect(result.current.settingsWorkspaceProps.isSavingEditorSettings).toBe(true);
    });

    saveDeferred.resolve(
      createEditorSettingsSnapshot({
        indentStyle: "tabs",
        tabSize: 4,
      }),
    );
    await act(async () => {
      await savePromise;
    });

    expect(maildraftApi.saveEditorSettings).toHaveBeenCalledWith({
      indentStyle: "tabs",
      tabSize: 4,
    });
    expect(result.current.settingsWorkspaceProps.editorSettings).toEqual({
      indentStyle: "tabs",
      tabSize: 4,
    });
    expect(result.current.settingsWorkspaceProps.editorForm).toEqual({
      indentStyle: "tabs",
      tabSize: 4,
    });
    expect(result.current.settingsWorkspaceProps.isSavingEditorSettings).toBe(false);
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("エディタ設定を保存しました。");
    expect(onBackupImported).not.toHaveBeenCalled();
  });

  it("normalizes invalid editor tab sizes in the editor form", () => {
    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
      }),
    );

    act(() => {
      result.current.settingsWorkspaceProps.onChangeEditor("tabSize", 99);
    });

    expect(result.current.settingsWorkspaceProps.editorForm.tabSize).toBe(2);
  });

  it("saves the active settings section for editor and logging only", async () => {
    vi.spyOn(maildraftApi, "saveEditorSettings").mockResolvedValue(
      createEditorSettingsSnapshot({
        indentStyle: "tabs",
        tabSize: 3,
      }),
    );
    vi.spyOn(maildraftApi, "saveLoggingSettings").mockResolvedValue(
      createLoggingSettingsSnapshot({
        mode: "standard",
      }),
    );

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
      }),
    );

    act(() => {
      result.current.settingsWorkspaceProps.onChangeEditor("indentStyle", "tabs");
      result.current.settingsWorkspaceProps.onChangeEditor("tabSize", 3);
    });
    await act(async () => {
      await result.current.saveSettingsSection();
    });
    expect(maildraftApi.saveEditorSettings).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.settingsWorkspaceProps.onSelectSection("logging");
      result.current.settingsWorkspaceProps.onChangeLogging("mode", "standard");
    });
    await act(async () => {
      await result.current.saveSettingsSection();
    });
    expect(maildraftApi.saveLoggingSettings).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.settingsWorkspaceProps.onSelectSection("proofreading");
    });
    await act(async () => {
      await result.current.saveSettingsSection();
    });
    expect(maildraftApi.saveEditorSettings).toHaveBeenCalledTimes(1);
    expect(maildraftApi.saveLoggingSettings).toHaveBeenCalledTimes(1);
  });

  it("saves proofreading settings and supports re-enabling disabled rules", async () => {
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "saveProofreadingSettings")
      .mockResolvedValueOnce(
        createProofreadingSettingsSnapshot({
          disabledRuleIds: ["prh", "whitespace.trailing"],
        }),
      )
      .mockResolvedValueOnce(
        createProofreadingSettingsSnapshot({
          disabledRuleIds: ["whitespace.trailing"],
        }),
      );

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError,
        onError,
        onNotice,
      }),
    );

    act(() => {
      result.current.hydrateProofreadingSettings(
        createProofreadingSettingsSnapshot({
          disabledRuleIds: ["prh"],
        }),
      );
    });

    await act(async () => {
      await result.current.disableProofreadingRule(" whitespace.trailing ");
    });

    expect(maildraftApi.saveProofreadingSettings).toHaveBeenNthCalledWith(1, {
      disabledRuleIds: ["prh", "whitespace.trailing"],
    });
    expect(result.current.settingsWorkspaceProps.proofreadingSettings.disabledRuleIds).toEqual([
      "prh",
      "whitespace.trailing",
    ]);

    await act(async () => {
      await result.current.settingsWorkspaceProps.onEnableProofreadingRule("prh");
    });

    expect(maildraftApi.saveProofreadingSettings).toHaveBeenNthCalledWith(2, {
      disabledRuleIds: ["whitespace.trailing"],
    });
    expect(result.current.settingsWorkspaceProps.proofreadingSettings.disabledRuleIds).toEqual([
      "whitespace.trailing",
    ]);
    expect(onClearError).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("校正ルール「行末スペース」を無効化しました。");
    expect(onNotice).toHaveBeenCalledWith("校正ルール「prh 言い換え」を有効化しました。");
  });

  it("clears logs and resets recent log state", async () => {
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "loadRecentLogs").mockResolvedValue([
      createLogEntry({ eventName: "save_draft" }),
    ]);
    vi.spyOn(maildraftApi, "clearLogs").mockResolvedValue(
      createLoggingSettingsSnapshot({
        totalBytes: 0,
        fileCount: 0,
      }),
    );

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError,
        onError,
        onNotice,
      }),
    );

    await act(async () => {
      await result.current.settingsWorkspaceProps.onRefreshRecentLogs({ silent: true });
    });
    expect(result.current.settingsWorkspaceProps.recentLogs).toHaveLength(1);

    await act(async () => {
      await result.current.settingsWorkspaceProps.onClearLogs();
    });

    expect(result.current.settingsWorkspaceProps.recentLogs).toEqual([]);
    expect(result.current.settingsWorkspaceProps.loggingSettings).toMatchObject({
      totalBytes: 0,
      fileCount: 0,
    });
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("診断ログを削除しました。");
  });

  it("refreshes recent logs and keeps silent refresh quiet", async () => {
    const onClearError = vi.fn();
    const onNotice = vi.fn();
    const loadRecentLogsDeferred = deferred<ReturnType<typeof createLogEntry>[]>();

    vi.spyOn(maildraftApi, "loadRecentLogs").mockReturnValueOnce(loadRecentLogsDeferred.promise);
    vi.spyOn(maildraftApi, "loadRecentLogs").mockResolvedValueOnce([
      createLogEntry({ eventName: "load_recent_logs" }),
    ]);

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError,
        onError: vi.fn(),
        onNotice,
      }),
    );

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.settingsWorkspaceProps.onRefreshRecentLogs();
    });
    await waitFor(() => {
      expect(result.current.settingsWorkspaceProps.isLoadingRecentLogs).toBe(true);
    });
    loadRecentLogsDeferred.resolve([createLogEntry({ eventName: "save_draft" })]);
    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.settingsWorkspaceProps.recentLogs[0]?.eventName).toBe("save_draft");
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith("最近のログを更新しました。");

    await act(async () => {
      await result.current.settingsWorkspaceProps.onRefreshRecentLogs({ silent: true });
    });

    expect(result.current.settingsWorkspaceProps.recentLogs[0]?.eventName).toBe("load_recent_logs");
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledTimes(1);
    expect(result.current.settingsWorkspaceProps.isLoadingRecentLogs).toBe(false);
  });

  it("reports refresh failures and clears the loading flag", async () => {
    const onError = vi.fn();

    vi.spyOn(maildraftApi, "loadRecentLogs").mockRejectedValue("読込失敗");

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError: vi.fn(),
        onError,
        onNotice: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.settingsWorkspaceProps.onRefreshRecentLogs();
    });

    expect(onError).toHaveBeenCalledWith("読込失敗");
    expect(result.current.settingsWorkspaceProps.isLoadingRecentLogs).toBe(false);
  });

  it("exports a backup when Rust confirms a destination and skips canceled exports", async () => {
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();
    const exportDeferred = deferred<string | null>();

    vi.spyOn(maildraftApi, "exportBackup")
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce(exportDeferred.promise);

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported: vi.fn(),
        onClearError,
        onError,
        onNotice,
      }),
    );

    await act(async () => {
      await result.current.settingsWorkspaceProps.onExportBackup();
    });

    expect(maildraftApi.exportBackup).toHaveBeenCalledTimes(1);
    expect(result.current.settingsWorkspaceProps.isExportingBackup).toBe(false);

    let exportPromise!: Promise<void>;
    act(() => {
      exportPromise = result.current.settingsWorkspaceProps.onExportBackup();
    });
    await waitFor(() => {
      expect(result.current.settingsWorkspaceProps.isExportingBackup).toBe(true);
    });
    exportDeferred.resolve("C:/tmp/maildraft-backup.json");
    await act(async () => {
      await exportPromise;
    });

    expect(maildraftApi.exportBackup).toHaveBeenCalledTimes(2);
    expect(onClearError).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("バックアップを書き出しました。");
    expect(result.current.settingsWorkspaceProps.isExportingBackup).toBe(false);
  });

  it("imports a backup after confirmation and ignores canceled flows", async () => {
    const onBackupImported = vi.fn();
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();
    const importDeferred = deferred<{
      editorSettings: ReturnType<typeof createEditorSettingsSnapshot>;
      loggingSettings: ReturnType<typeof createLoggingSettingsSnapshot>;
      proofreadingSettings: ReturnType<typeof createProofreadingSettingsSnapshot>;
      snapshot: ReturnType<typeof createStoreSnapshot>;
    } | null>();

    confirmMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    vi.spyOn(maildraftApi, "importBackup")
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce(importDeferred.promise);

    const { result } = renderHook(() =>
      useSettingsWorkspaceState({
        onBackupImported,
        onClearError,
        onError,
        onNotice,
      }),
    );

    await act(async () => {
      await result.current.settingsWorkspaceProps.onImportBackup();
    });
    expect(maildraftApi.importBackup).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.settingsWorkspaceProps.onImportBackup();
    });
    expect(maildraftApi.importBackup).toHaveBeenCalledTimes(1);
    expect(result.current.settingsWorkspaceProps.isImportingBackup).toBe(false);

    let importPromise!: Promise<void>;
    act(() => {
      importPromise = result.current.settingsWorkspaceProps.onImportBackup();
    });
    await waitFor(() => {
      expect(result.current.settingsWorkspaceProps.isImportingBackup).toBe(true);
    });
    importDeferred.resolve({
      editorSettings: createEditorSettingsSnapshot({
        indentStyle: "tabs",
        tabSize: 4,
      }),
      loggingSettings: createLoggingSettingsSnapshot({
        mode: "standard",
        retentionDays: 30,
      }),
      proofreadingSettings: createProofreadingSettingsSnapshot({
        disabledRuleIds: ["prh"],
      }),
      snapshot: createStoreSnapshot({
        drafts: [],
        draftHistory: [],
      }),
    });
    await act(async () => {
      await importPromise;
    });

    expect(maildraftApi.importBackup).toHaveBeenCalledTimes(2);
    expect(onBackupImported).toHaveBeenCalledWith(
      expect.objectContaining({
        drafts: [],
        draftHistory: [],
      }),
    );
    expect(result.current.settingsWorkspaceProps.loggingSettings).toMatchObject({
      mode: "standard",
      retentionDays: 30,
    });
    expect(result.current.settingsWorkspaceProps.editorSettings).toEqual({
      indentStyle: "tabs",
      tabSize: 4,
    });
    expect(result.current.settingsWorkspaceProps.proofreadingSettings.disabledRuleIds).toEqual([
      "prh",
    ]);
    expect(onClearError).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("バックアップを読み込みました。");
    expect(result.current.settingsWorkspaceProps.isImportingBackup).toBe(false);
  });
});

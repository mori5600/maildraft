import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  createLogEntry,
  createLoggingSettingsSnapshot,
  createStoreSnapshot,
} from "../../../test/ui-fixtures";
import { useSettingsWorkspaceState } from "./use-settings-workspace-state";

const { confirmMock, openMock, saveMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  openMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: confirmMock,
  open: openMock,
  save: saveMock,
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

  it("exports a backup when a path is chosen and skips canceled exports", async () => {
    const onClearError = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();
    const exportDeferred = deferred<string>();

    saveMock.mockResolvedValueOnce(null).mockResolvedValueOnce("C:/tmp/maildraft-backup.json");
    vi.spyOn(maildraftApi, "exportBackup").mockReturnValue(exportDeferred.promise);

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

    expect(maildraftApi.exportBackup).not.toHaveBeenCalled();
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

    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "MailDraft バックアップを書き出す",
      }),
    );
    expect(maildraftApi.exportBackup).toHaveBeenCalledWith("C:/tmp/maildraft-backup.json");
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
      loggingSettings: ReturnType<typeof createLoggingSettingsSnapshot>;
      snapshot: ReturnType<typeof createStoreSnapshot>;
    }>();

    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    openMock.mockResolvedValueOnce(null).mockResolvedValueOnce("C:/tmp/backup.json");
    vi.spyOn(maildraftApi, "importBackup").mockReturnValue(importDeferred.promise);

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
    expect(openMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.settingsWorkspaceProps.onImportBackup();
    });
    expect(maildraftApi.importBackup).not.toHaveBeenCalled();
    expect(result.current.settingsWorkspaceProps.isImportingBackup).toBe(false);

    let importPromise!: Promise<void>;
    act(() => {
      importPromise = result.current.settingsWorkspaceProps.onImportBackup();
    });
    await waitFor(() => {
      expect(result.current.settingsWorkspaceProps.isImportingBackup).toBe(true);
    });
    importDeferred.resolve({
      loggingSettings: createLoggingSettingsSnapshot({
        mode: "standard",
        retentionDays: 30,
      }),
      snapshot: createStoreSnapshot({
        drafts: [],
        draftHistory: [],
      }),
    });
    await act(async () => {
      await importPromise;
    });

    expect(maildraftApi.importBackup).toHaveBeenCalledWith("C:/tmp/backup.json");
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
    expect(onClearError).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("バックアップを読み込みました。");
    expect(result.current.settingsWorkspaceProps.isImportingBackup).toBe(false);
  });
});

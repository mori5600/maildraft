import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLoggingSettingsSnapshot, createStoreSnapshot } from "../../test/ui-fixtures";

const apiMocks = vi.hoisted(() => ({
  loadLoggingSettings: vi.fn(),
  loadSnapshot: vi.fn(),
  loadStartupNotice: vi.fn(),
}));

vi.mock("../../shared/api/maildraft-api", () => ({
  maildraftApi: {
    loadLoggingSettings: apiMocks.loadLoggingSettings,
    loadSnapshot: apiMocks.loadSnapshot,
    loadStartupNotice: apiMocks.loadStartupNotice,
  },
}));

import { useAppBootstrap } from "./use-app-bootstrap";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function createCallbacks() {
  return {
    hydrateLoggingSettings: vi.fn(),
    hydrateSnapshot: vi.fn(),
    onClearError: vi.fn(),
    onError: vi.fn(),
    onLoadingChange: vi.fn(),
    onNotice: vi.fn(),
    onWarning: vi.fn(),
  };
}

describe("useAppBootstrap", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads snapshot and logging settings and shows the default notice when startup is clean", async () => {
    const snapshot = createStoreSnapshot();
    const loggingSettings = createLoggingSettingsSnapshot();
    const callbacks = createCallbacks();

    apiMocks.loadSnapshot.mockResolvedValue(snapshot);
    apiMocks.loadLoggingSettings.mockResolvedValue(loggingSettings);
    apiMocks.loadStartupNotice.mockResolvedValue(null);

    renderHook(() => useAppBootstrap(callbacks));

    await waitFor(() => {
      expect(callbacks.hydrateSnapshot).toHaveBeenCalledWith(snapshot);
      expect(callbacks.hydrateLoggingSettings).toHaveBeenCalledWith(loggingSettings);
    });

    expect(callbacks.onLoadingChange).toHaveBeenNthCalledWith(1, true);
    expect(callbacks.onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(callbacks.onClearError).toHaveBeenCalledTimes(1);
    expect(callbacks.onNotice).toHaveBeenCalledWith("ローカルデータと診断設定を読み込みました。");
    expect(callbacks.onWarning).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("surfaces a startup notice with notice tone as-is", async () => {
    const snapshot = createStoreSnapshot();
    const loggingSettings = createLoggingSettingsSnapshot();
    const callbacks = createCallbacks();

    apiMocks.loadSnapshot.mockResolvedValue(snapshot);
    apiMocks.loadLoggingSettings.mockResolvedValue(loggingSettings);
    apiMocks.loadStartupNotice.mockResolvedValue({
      message: "バックアップを読み込みました。",
      tone: "notice",
    });

    renderHook(() => useAppBootstrap(callbacks));

    await waitFor(() => {
      expect(callbacks.onNotice).toHaveBeenCalledWith("バックアップを読み込みました。");
    });

    expect(callbacks.onWarning).not.toHaveBeenCalled();
  });

  it("uses the latest callbacks after rerender while an in-flight bootstrap resolves", async () => {
    const snapshot = createStoreSnapshot();
    const loggingSettings = createLoggingSettingsSnapshot();
    const snapshotDeferred = deferred<typeof snapshot>();
    const loggingDeferred = deferred<typeof loggingSettings>();
    const startupDeferred = deferred<{ message: string; tone: "warning" }>();
    const initialCallbacks = createCallbacks();
    const latestCallbacks = createCallbacks();

    apiMocks.loadSnapshot.mockReturnValue(snapshotDeferred.promise);
    apiMocks.loadLoggingSettings.mockReturnValue(loggingDeferred.promise);
    apiMocks.loadStartupNotice.mockReturnValue(startupDeferred.promise);

    const { rerender } = renderHook((callbacks) => useAppBootstrap(callbacks), {
      initialProps: initialCallbacks,
    });

    await waitFor(() => {
      expect(initialCallbacks.onLoadingChange).toHaveBeenCalledWith(true);
    });
    expect(initialCallbacks.onClearError).toHaveBeenCalledTimes(1);

    rerender(latestCallbacks);
    snapshotDeferred.resolve(snapshot);
    loggingDeferred.resolve(loggingSettings);
    startupDeferred.resolve({
      message: "ローカルデータを復旧しました。",
      tone: "warning",
    });

    await waitFor(() => {
      expect(latestCallbacks.hydrateSnapshot).toHaveBeenCalledWith(snapshot);
      expect(latestCallbacks.hydrateLoggingSettings).toHaveBeenCalledWith(loggingSettings);
      expect(latestCallbacks.onWarning).toHaveBeenCalledWith("ローカルデータを復旧しました。");
      expect(latestCallbacks.onLoadingChange).toHaveBeenCalledWith(false);
    });

    expect(initialCallbacks.hydrateSnapshot).not.toHaveBeenCalled();
    expect(initialCallbacks.hydrateLoggingSettings).not.toHaveBeenCalled();
    expect(initialCallbacks.onWarning).not.toHaveBeenCalled();
  });

  it("reports bootstrap failures as user-facing errors", async () => {
    const callbacks = createCallbacks();

    apiMocks.loadSnapshot.mockRejectedValue(new Error("読み込みに失敗しました。"));
    apiMocks.loadLoggingSettings.mockResolvedValue(createLoggingSettingsSnapshot());
    apiMocks.loadStartupNotice.mockResolvedValue(null);

    renderHook(() => useAppBootstrap(callbacks));

    await waitFor(() => {
      expect(callbacks.onError).toHaveBeenCalledWith("読み込みに失敗しました。");
    });

    expect(callbacks.hydrateSnapshot).not.toHaveBeenCalled();
    expect(callbacks.hydrateLoggingSettings).not.toHaveBeenCalled();
    expect(callbacks.onLoadingChange).toHaveBeenLastCalledWith(false);
  });
});

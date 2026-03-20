import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getVersionMock, isTauriMock, tauriWriteTextMock } = vi.hoisted(() => ({
  getVersionMock: vi.fn(),
  isTauriMock: vi.fn(),
  tauriWriteTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: getVersionMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: isTauriMock,
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: tauriWriteTextMock,
}));

import { FALLBACK_APP_INFO, loadAppInfo } from "./app-info";
import { copyPlainText } from "./clipboard";
import { applyTheme, persistTheme, resolveInitialTheme, THEME_STORAGE_KEY } from "./theme";

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("runtime helpers", () => {
  beforeEach(() => {
    getVersionMock.mockReset();
    isTauriMock.mockReset();
    tauriWriteTextMock.mockReset();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    installMatchMedia(false);
    Reflect.deleteProperty(navigator, "clipboard");
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("prefers the stored theme and otherwise falls back to the system preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    installMatchMedia(false);
    expect(resolveInitialTheme()).toBe("light");

    localStorage.removeItem(THEME_STORAGE_KEY);
    installMatchMedia(true);
    expect(resolveInitialTheme()).toBe("light");

    installMatchMedia(false);
    expect(resolveInitialTheme()).toBe("dark");
  });

  it("applies and persists the selected theme", () => {
    applyTheme("light");
    persistTheme("light");

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("copies text through the Tauri clipboard bridge when running in Tauri", async () => {
    isTauriMock.mockReturnValue(true);
    tauriWriteTextMock.mockResolvedValue(undefined);
    const browserWriteText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: browserWriteText },
    });

    await copyPlainText("hello");

    expect(tauriWriteTextMock).toHaveBeenCalledWith("hello");
    expect(browserWriteText).not.toHaveBeenCalled();
  });

  it("falls back to navigator.clipboard outside Tauri", async () => {
    isTauriMock.mockReturnValue(false);
    const browserWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: browserWriteText },
    });

    await copyPlainText("browser");

    expect(browserWriteText).toHaveBeenCalledWith("browser");
    expect(tauriWriteTextMock).not.toHaveBeenCalled();
  });

  it("throws a stable error when no clipboard API is available", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(copyPlainText("no clipboard")).rejects.toThrow(
      "この環境ではクリップボードにコピーできません。",
    );
  });

  it("loads the runtime app version and falls back to build-time metadata on failure", async () => {
    getVersionMock.mockResolvedValue("9.9.9");
    await expect(loadAppInfo()).resolves.toEqual({
      name: FALLBACK_APP_INFO.name,
      version: "9.9.9",
    });

    getVersionMock.mockRejectedValue(new Error("unavailable"));
    await expect(loadAppInfo()).resolves.toEqual(FALLBACK_APP_INFO);
  });
});

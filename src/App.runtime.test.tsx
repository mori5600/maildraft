import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import { THEME_STORAGE_KEY } from "./shared/lib/theme";
import {
  createRuntimeDraft,
  createSeededRuntimeSnapshot,
  installMockTauriRuntime,
  resetMockTauriRuntime,
} from "./test/tauri-runtime";
import { createLoggingSettingsSnapshot } from "./test/ui-fixtures";

function installLocalStorageMock() {
  const values = new Map<string, string>();

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear() {
        values.clear();
      },
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      },
      setItem(key: string, value: string) {
        values.set(key, String(value));
      },
    },
  });
}

function resetThemeStorage() {
  const storage = window.localStorage as { clear?: () => void; removeItem?: (key: string) => void };

  if (typeof storage.clear === "function") {
    storage.clear();
    return;
  }

  if (typeof storage.removeItem === "function") {
    storage.removeItem(THEME_STORAGE_KEY);
  }
}

describe("App runtime integration", () => {
  beforeEach(() => {
    installLocalStorageMock();
    resetThemeStorage();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    resetMockTauriRuntime();
    resetThemeStorage();
    delete document.documentElement.dataset.theme;
  });

  it("boots from mocked Tauri IPC and saves an edited draft", async () => {
    const user = userEvent.setup();
    const runtime = installMockTauriRuntime({
      loggingSettings: createLoggingSettingsSnapshot({ fileCount: 0, totalBytes: 0 }),
      snapshot: createSeededRuntimeSnapshot({
        draftHistory: [],
      }),
    });

    render(<App />);

    expect(await screen.findByDisplayValue("4/12 打ち合わせお礼")).toBeInTheDocument();
    expect(runtime.commandCalls.slice(0, 3).map((call) => call.cmd)).toEqual([
      "load_snapshot",
      "load_logging_settings",
      "load_startup_notice",
    ]);

    fireEvent.change(screen.getByLabelText("件名"), {
      target: { value: "統合テストの件名" },
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(runtime.getSnapshot().drafts[0]?.subject).toBe("統合テストの件名");
    });
    expect(runtime.commandCalls.some((call) => call.cmd === "save_draft")).toBe(true);
    expect(await screen.findByText("下書きを保存しました。")).toBeInTheDocument();
  });

  it("shows startup recovery warnings returned by the Tauri runtime", async () => {
    installMockTauriRuntime({
      snapshot: createSeededRuntimeSnapshot(),
      startupNotice: {
        message: "ローカルデータを復旧できなかったため初期状態で起動しました。",
        tone: "warning",
      },
    });

    render(<App />);

    expect(await screen.findByDisplayValue("4/12 打ち合わせお礼")).toBeInTheDocument();
    expect(
      await screen.findByText("ローカルデータを復旧できなかったため初期状態で起動しました。"),
    ).toBeInTheDocument();
  });

  it("persists logging settings through the Tauri command boundary", async () => {
    const user = userEvent.setup();
    const runtime = installMockTauriRuntime({
      loggingSettings: createLoggingSettingsSnapshot({ mode: "errors_only" }),
      snapshot: createSeededRuntimeSnapshot(),
    });

    render(<App />);
    await screen.findByDisplayValue("4/12 打ち合わせお礼");

    await user.click(screen.getByTitle("設定 (Ctrl/Cmd+5)"));
    await user.selectOptions(screen.getByLabelText(/記録レベル/), "standard");
    await user.click(
      within(screen.getByText("ログ設定").closest("section") as HTMLElement).getByRole("button", {
        name: "保存",
      }),
    );

    await waitFor(() => {
      expect(runtime.getLoggingSettings().mode).toBe("standard");
    });
    expect(runtime.commandCalls.some((call) => call.cmd === "save_logging_settings")).toBe(true);
    expect(await screen.findByText("ログ設定を保存しました。")).toBeInTheDocument();
  });

  it("restores a trashed draft and reopens it in the drafts workspace", async () => {
    const user = userEvent.setup();
    const runtime = installMockTauriRuntime({
      snapshot: createSeededRuntimeSnapshot({
        draftHistory: [],
        drafts: [
          createRuntimeDraft({
            id: "draft-live",
            title: "現在の下書き",
            subject: "現在の件名",
          }),
        ],
        trash: {
          drafts: [
            {
              draft: createRuntimeDraft({
                id: "draft-trash",
                title: "削除した下書き",
                subject: "復元対象の件名",
              }),
              history: [],
              deletedAt: "1710000009999",
            },
          ],
          templates: [],
          signatures: [],
        },
      }),
    });

    render(<App />);
    await screen.findByDisplayValue("現在の下書き");

    await user.click(screen.getByTitle("ゴミ箱 (Ctrl/Cmd+4)"));
    expect((await screen.findAllByText("削除した下書き")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "復元" }));

    await waitFor(() => {
      expect(runtime.getSnapshot().trash.drafts).toHaveLength(0);
    });
    expect(runtime.commandCalls.some((call) => call.cmd === "restore_draft_from_trash")).toBe(true);
    expect(await screen.findByText("下書きをゴミ箱から復元しました。")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("一覧名")).toHaveValue("削除した下書き");
    });
  });

  it("keeps the draft list empty after deleting the last saved draft", async () => {
    const user = userEvent.setup();
    const runtime = installMockTauriRuntime({
      snapshot: createSeededRuntimeSnapshot({
        draftHistory: [],
        drafts: [
          createRuntimeDraft({
            id: "draft-last",
            title: "最後の下書き",
            subject: "最後の件名",
            signatureId: "signature-1",
          }),
        ],
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
        },
      }),
    });

    render(<App />);
    expect(await screen.findByDisplayValue("最後の下書き")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ゴミ箱へ移動" }));

    await waitFor(() => {
      expect(runtime.getSnapshot().drafts).toHaveLength(0);
    });
    expect(await screen.findByText("まだ下書きはありません。")).toBeInTheDocument();

    await new Promise((resolve) => window.setTimeout(resolve, 1000));

    expect(runtime.getSnapshot().drafts).toHaveLength(0);
    expect(runtime.commandCalls.filter((call) => call.cmd === "save_draft")).toHaveLength(0);
  });
});

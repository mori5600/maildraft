import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "./App";

const mockUseMaildraftApp = vi.fn();

vi.mock("./app/state/use-maildraft-app", () => ({
  useMaildraftApp: (ref: unknown) => mockUseMaildraftApp(ref),
}));

vi.mock("./modules/drafts/ui/DraftWorkspaceScreen", () => ({
  DraftWorkspaceScreen: () => <div>DraftWorkspaceScreen</div>,
}));

vi.mock("./modules/templates/ui/TemplateWorkspace", () => ({
  TemplateWorkspace: () => <div>TemplateWorkspace</div>,
}));

vi.mock("./modules/signatures/ui/SignatureWorkspace", () => ({
  SignatureWorkspace: () => <div>SignatureWorkspace</div>,
}));

vi.mock("./modules/trash/ui/TrashWorkspace", () => ({
  TrashWorkspace: () => <div>TrashWorkspace</div>,
}));

vi.mock("./modules/settings/ui/SettingsWorkspace", () => ({
  SettingsWorkspace: () => <div>SettingsWorkspace</div>,
}));

vi.mock("./modules/help/ui/HelpWorkspace", () => ({
  HelpWorkspace: () => <div>HelpWorkspace</div>,
}));

vi.mock("./modules/memo/ui/MemoWorkspace", () => ({
  MemoWorkspace: () => <div>MemoWorkspace</div>,
}));

function createAppState(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    view: "drafts",
    views: [
      { id: "drafts", label: "下書き", count: 1 },
      { id: "templates", label: "テンプレート", count: 2 },
      { id: "signatures", label: "署名", count: 1 },
      { id: "memo", label: "メモ" },
      { id: "trash", label: "ゴミ箱", count: 0 },
      { id: "settings", label: "設定" },
      { id: "help", label: "ヘルプ" },
    ],
    error: null,
    notice: "保存しました",
    warning: null,
    theme: "dark",
    showWhitespace: true,
    toggleTheme: vi.fn(),
    toggleWhitespace: vi.fn(),
    setView: vi.fn(),
    draftWorkspaceProps: {},
    memoWorkspaceProps: {},
    templateWorkspaceProps: {},
    signatureWorkspaceProps: {},
    trashWorkspaceProps: {},
    settingsWorkspaceProps: {},
    ...overrides,
  };
}

describe("App", () => {
  it("renders loading state", () => {
    mockUseMaildraftApp.mockReturnValue(createAppState({ isLoading: true }));

    render(<App />);

    expect(screen.getByText("ローカルワークスペースを起動しています")).toBeInTheDocument();
  });

  it("renders sidebar and handles global controls", async () => {
    const user = userEvent.setup();
    const appState = createAppState();
    mockUseMaildraftApp.mockReturnValue(appState);

    render(<App />);

    expect(screen.getByText("DraftWorkspaceScreen")).toBeInTheDocument();
    expect(screen.getByText("保存しました")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /テンプレート/ }));
    expect(appState.setView).toHaveBeenCalledWith("templates");

    await user.click(screen.getByRole("button", { name: "ダーク表示" }));
    expect(appState.toggleTheme).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "空白表示" }));
    expect(appState.toggleWhitespace).toHaveBeenCalled();
  });

  it("hides whitespace button on settings/help views", () => {
    mockUseMaildraftApp.mockReturnValue(createAppState({ view: "settings" }));

    render(<App />);

    expect(screen.queryByRole("button", { name: "空白表示" })).not.toBeInTheDocument();
    expect(screen.getByText("SettingsWorkspace")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_APP_INFO } from "../../../shared/lib/app-info";
import { HelpWorkspace } from "./HelpWorkspace";
import { HelpSectionNav } from "./panes/HelpSectionNav";
import { ShortcutGuide } from "./panes/ShortcutGuide";
import { UsageGuide } from "./panes/UsageGuide";

vi.mock("../../../shared/lib/app-info", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/lib/app-info")>(
    "../../../shared/lib/app-info",
  );

  return {
    ...actual,
    loadAppInfo: vi.fn(async () => ({ name: "MailDraft", version: "9.9.9" })),
  };
});

describe("help UI", () => {
  it("renders help navigation and switches sections", async () => {
    const user = userEvent.setup();
    const handleSelectSection = vi.fn();
    render(
      <HelpSectionNav
        activeSection="usage"
        appInfo={FALLBACK_APP_INFO}
        onSelectSection={handleSelectSection}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ショートカット/ }));
    expect(handleSelectSection).toHaveBeenCalledWith("shortcuts");
  });

  it("renders usage and shortcut guides", () => {
    render(
      <>
        <UsageGuide />
        <ShortcutGuide />
      </>,
    );

    expect(screen.getByText("使い方")).toBeInTheDocument();
    expect(screen.getByText("ショートカット一覧")).toBeInTheDocument();
  });

  it("loads app info in help workspace", async () => {
    const user = userEvent.setup();
    render(<HelpWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("バージョン 9.9.9")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /ショートカット/ }));
    expect(screen.getByText("ショートカット一覧")).toBeInTheDocument();
  });
});

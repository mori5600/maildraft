import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DraftWorkspaceHandle } from "../state/use-draft-workspace-state";
import { DraftWorkspaceScreen } from "./DraftWorkspaceScreen";

const mockUseDraftWorkspaceState = vi.fn();
const mockDraftWorkspace = vi.fn(({ showWhitespace }: { showWhitespace: boolean }) => (
  <div>DraftWorkspace {String(showWhitespace)}</div>
));

vi.mock("../state/use-draft-workspace-state", () => ({
  useDraftWorkspaceState: (args: unknown) => mockUseDraftWorkspaceState(args),
}));

vi.mock("./DraftWorkspace", () => ({
  DraftWorkspace: (props: unknown) => mockDraftWorkspace(props as { showWhitespace: boolean }),
}));

describe("DraftWorkspaceScreen", () => {
  it("bridges hook state into DraftWorkspace and ref", () => {
    const handle = { createDraft: vi.fn() } as unknown as DraftWorkspaceHandle;
    mockUseDraftWorkspaceState.mockReturnValue({
      handle,
      workspaceProps: {
        drafts: [],
      },
    });
    const ref = createRef<DraftWorkspaceHandle>();

    render(
      <DraftWorkspaceScreen
        ref={ref}
        showWhitespace
        snapshot={{ drafts: [], draftHistory: [], variablePresets: [], templates: [], signatures: [], trash: { drafts: [], templates: [], signatures: [] } }}
        onClearError={vi.fn()}
        onError={vi.fn()}
        onNotice={vi.fn()}
        onSnapshotChange={vi.fn()}
      />,
    );

    expect(screen.getByText("DraftWorkspace true")).toBeInTheDocument();
    expect(ref.current).toBe(handle);
    expect(mockUseDraftWorkspaceState).toHaveBeenCalled();
  });
});

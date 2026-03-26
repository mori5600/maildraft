import { describe, expect, it, vi } from "vitest";

import type { DraftWorkspaceHandle } from "../../modules/drafts/ui/DraftWorkspaceScreen";
import { createSignature, createStoreSnapshot, createTemplate } from "../../test/ui-fixtures";
import {
  changeWorkspaceView,
  EMPTY_SNAPSHOT,
  hydrateImportedBackup,
  hydrateWorkspaceSnapshot,
} from "./maildraft-app-orchestration";

describe("maildraft app orchestration", () => {
  it("hydrates dependent workspace selections from a full snapshot replacement", () => {
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
    const actions = {
      hydrateMemoState: vi.fn(),
      hydrateSignatureState: vi.fn(),
      hydrateTemplateState: vi.fn(),
      setSelectedTrashItemKey: vi.fn(),
      setSnapshot: vi.fn(),
    };

    hydrateWorkspaceSnapshot(nextSnapshot, actions);

    expect(actions.setSnapshot).toHaveBeenCalledWith(nextSnapshot);
    expect(actions.hydrateMemoState).toHaveBeenCalledWith(nextSnapshot);
    expect(actions.hydrateTemplateState).toHaveBeenCalledWith(nextSnapshot, "template-imported");
    expect(actions.hydrateSignatureState).toHaveBeenCalledWith(nextSnapshot, "signature-imported");
    expect(actions.setSelectedTrashItemKey).toHaveBeenCalledWith("draft:draft-1");
  });

  it("flushes only the current workspace before changing view", () => {
    const actions = {
      currentView: "templates" as const,
      flushDrafts: vi.fn(),
      flushMemo: vi.fn(),
      flushSignatures: vi.fn(),
      flushTemplates: vi.fn(),
      setViewState: vi.fn(),
    };

    changeWorkspaceView("signatures", actions);

    expect(actions.flushTemplates).toHaveBeenCalledTimes(1);
    expect(actions.flushDrafts).not.toHaveBeenCalled();
    expect(actions.flushMemo).not.toHaveBeenCalled();
    expect(actions.flushSignatures).not.toHaveBeenCalled();
    expect(actions.setViewState).toHaveBeenCalledWith("signatures");
  });

  it("hydrates imported backups into both shell workspaces and the draft handle", () => {
    const nextSnapshot = createStoreSnapshot();
    const hydrateSnapshot = vi.fn();
    const draftWorkspaceHandle = {
      hydrateSnapshot: vi.fn(),
    } as unknown as DraftWorkspaceHandle;

    hydrateImportedBackup(nextSnapshot, draftWorkspaceHandle, hydrateSnapshot);

    expect(hydrateSnapshot).toHaveBeenCalledWith(nextSnapshot);
    expect(draftWorkspaceHandle.hydrateSnapshot).toHaveBeenCalledWith(nextSnapshot);
  });

  it("keeps an empty snapshot shape available for shell bootstrap", () => {
    expect(EMPTY_SNAPSHOT).toEqual({
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
    });
  });
});

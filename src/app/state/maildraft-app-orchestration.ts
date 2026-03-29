import type { DraftWorkspaceHandle } from "../../modules/drafts/ui/DraftWorkspaceScreen";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";
import { buildHydratedWorkspaceState } from "./maildraft-app-helpers";

export const EMPTY_SNAPSHOT: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  blocks: [],
  templates: [],
  signatures: [],
  memos: [],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
    memos: [],
    blocks: [],
  },
};

export interface HydrateWorkspaceSnapshotActions {
  hydrateBlockState: (snapshot: StoreSnapshot, blockId: string | null) => void;
  hydrateMemoState: (snapshot: StoreSnapshot) => void;
  hydrateSignatureState: (snapshot: StoreSnapshot, signatureId: string | null) => void;
  hydrateTemplateState: (snapshot: StoreSnapshot, templateId: string | null) => void;
  setSelectedTrashItemKey: (key: string | null) => void;
  setSnapshot: (snapshot: StoreSnapshot) => void;
}

export function hydrateWorkspaceSnapshot(
  nextSnapshot: StoreSnapshot,
  actions: HydrateWorkspaceSnapshotActions,
) {
  const hydratedState = buildHydratedWorkspaceState(nextSnapshot);
  actions.setSnapshot(nextSnapshot);
  actions.hydrateBlockState(nextSnapshot, hydratedState.selectedBlockId);
  actions.hydrateMemoState(nextSnapshot);
  actions.hydrateTemplateState(nextSnapshot, hydratedState.selectedTemplateId);
  actions.hydrateSignatureState(nextSnapshot, hydratedState.selectedSignatureId);
  actions.setSelectedTrashItemKey(hydratedState.selectedTrashItemKey);
}

type WorkspaceFlushAction = (() => void) | null;

export interface ChangeWorkspaceViewActions {
  currentView: WorkspaceView;
  flushBlocks: () => void;
  flushDrafts: () => void;
  flushMemo: () => void;
  flushSignatures: () => void;
  flushTemplates: () => void;
  setViewState: (view: WorkspaceView) => void;
}

const VIEW_FLUSHERS: Record<
  WorkspaceView,
  keyof Omit<ChangeWorkspaceViewActions, "currentView" | "setViewState"> | null
> = {
  drafts: "flushDrafts",
  templates: "flushTemplates",
  blocks: "flushBlocks",
  signatures: "flushSignatures",
  memo: "flushMemo",
  trash: null,
  settings: null,
  help: null,
};

export function changeWorkspaceView(nextView: WorkspaceView, actions: ChangeWorkspaceViewActions) {
  if (actions.currentView !== nextView) {
    const flusherKey = VIEW_FLUSHERS[actions.currentView];
    const flusher: WorkspaceFlushAction = flusherKey ? actions[flusherKey] : null;
    flusher?.();
  }

  actions.setViewState(nextView);
}

export function hydrateImportedBackup(
  nextSnapshot: StoreSnapshot,
  draftWorkspaceHandle: DraftWorkspaceHandle | null,
  hydrateSnapshot: (snapshot: StoreSnapshot) => void,
) {
  hydrateSnapshot(nextSnapshot);
  draftWorkspaceHandle?.hydrateSnapshot(nextSnapshot);
}

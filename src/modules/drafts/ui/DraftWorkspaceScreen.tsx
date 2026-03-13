import { forwardRef, useImperativeHandle } from "react";

import type { StoreSnapshot } from "../../../shared/types/store";
import {
  type DraftWorkspaceHandle,
  useDraftWorkspaceState,
} from "../state/use-draft-workspace-state";
import { DraftWorkspace } from "./DraftWorkspace";

interface DraftWorkspaceScreenProps {
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  showWhitespace: boolean;
  snapshot: StoreSnapshot;
}

export type { DraftWorkspaceHandle } from "../state/use-draft-workspace-state";

export const DraftWorkspaceScreen = forwardRef<DraftWorkspaceHandle, DraftWorkspaceScreenProps>(
  function DraftWorkspaceScreen(
    { onClearError, onError, onNotice, onSnapshotChange, showWhitespace, snapshot },
    ref,
  ) {
    const state = useDraftWorkspaceState({
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      snapshot,
    });

    useImperativeHandle(ref, () => state.handle, [state.handle]);

    return <DraftWorkspace {...state.workspaceProps} showWhitespace={showWhitespace} />;
  },
);

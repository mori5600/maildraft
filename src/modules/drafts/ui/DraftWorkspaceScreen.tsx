import { forwardRef, useImperativeHandle } from "react";

import type { StoreSnapshot } from "../../../shared/types/store";
import type { EditorSettings } from "../../../shared/ui/code-editor/editor-settings";
import type { TemplateInput } from "../../templates/model";
import {
  type DraftWorkspaceHandle,
  useDraftWorkspaceState,
} from "../state/use-draft-workspace-state";
import { DraftWorkspace } from "./DraftWorkspace";

interface DraftWorkspaceScreenProps {
  disabledProofreadingRuleIds: string[];
  editorSettings?: EditorSettings;
  onDisableProofreadingRule: (ruleId: string) => Promise<void>;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onOpenTemplateInput: (input: TemplateInput) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  showWhitespace: boolean;
  snapshot: StoreSnapshot;
}

export type { DraftWorkspaceHandle } from "../state/use-draft-workspace-state";

export const DraftWorkspaceScreen = forwardRef<DraftWorkspaceHandle, DraftWorkspaceScreenProps>(
  function DraftWorkspaceScreen(
    {
      disabledProofreadingRuleIds,
      editorSettings,
      onClearError,
      onDisableProofreadingRule,
      onError,
      onNotice,
      onOpenTemplateInput,
      onSnapshotChange,
      showWhitespace,
      snapshot,
    },
    ref,
  ) {
    const state = useDraftWorkspaceState({
      disabledRuleIds: disabledProofreadingRuleIds,
      onDisableProofreadingRule,
      onClearError,
      onError,
      onNotice,
      onOpenTemplateInput,
      onSnapshotChange,
      snapshot,
    });

    useImperativeHandle(ref, () => state.handle, [state.handle]);

    return (
      <DraftWorkspace
        {...state.workspaceProps}
        editorSettings={editorSettings}
        showWhitespace={showWhitespace}
      />
    );
  },
);

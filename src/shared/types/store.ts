import type { Draft, DraftHistoryEntry } from "../../modules/drafts/model";
import type { VariablePreset } from "../../modules/drafts/variable-presets";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";
import type { TrashSnapshot } from "../../modules/trash/model";

export interface StoreSnapshot {
  drafts: Draft[];
  draftHistory: DraftHistoryEntry[];
  variablePresets: VariablePreset[];
  templates: Template[];
  signatures: Signature[];
  trash: TrashSnapshot;
}

export interface StartupNoticeSnapshot {
  message: string;
  tone: "notice" | "warning";
}

export type WorkspaceView = "drafts" | "templates" | "signatures" | "trash" | "settings" | "help";

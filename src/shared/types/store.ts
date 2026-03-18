import type { Draft, DraftHistoryEntry } from "../../modules/drafts/model";
import type { VariablePreset } from "../../modules/drafts/variable-presets";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";
import type { TrashSnapshot } from "../../modules/trash/model";

/** Frontend source of truth hydrated from the backend snapshot. */
export interface StoreSnapshot {
  drafts: Draft[];
  draftHistory: DraftHistoryEntry[];
  variablePresets: VariablePreset[];
  templates: Template[];
  signatures: Signature[];
  trash: TrashSnapshot;
}

/** `save_draft` returns this payload instead of a full snapshot. */
export interface SaveDraftResult {
  draft: Draft;
  draftHistory: DraftHistoryEntry[];
}

export interface SaveTemplateResult {
  template: Template;
}

export interface SaveSignatureResult {
  signatures: Signature[];
}

/** Startup notice shown after recovery or reset. */
export interface StartupNoticeSnapshot {
  message: string;
  tone: "notice" | "warning";
}

export type WorkspaceView = "drafts" | "templates" | "signatures" | "trash" | "settings" | "help";

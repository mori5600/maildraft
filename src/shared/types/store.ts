import type { Draft, DraftHistoryEntry } from "../../modules/drafts/model";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";
import type { TrashSnapshot } from "../../modules/trash/model";

export interface StoreSnapshot {
  drafts: Draft[];
  draftHistory: DraftHistoryEntry[];
  templates: Template[];
  signatures: Signature[];
  trash: TrashSnapshot;
}

export type WorkspaceView =
  | "drafts"
  | "templates"
  | "signatures"
  | "trash"
  | "settings"
  | "help";

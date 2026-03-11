import type { Draft, DraftHistoryEntry } from "../../modules/drafts/model";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";

export interface StoreSnapshot {
  drafts: Draft[];
  draftHistory: DraftHistoryEntry[];
  templates: Template[];
  signatures: Signature[];
}

export type WorkspaceView = "drafts" | "templates" | "signatures" | "settings";

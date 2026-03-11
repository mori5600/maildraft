import type { Draft } from "../../modules/drafts/model";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";

export interface StoreSnapshot {
  drafts: Draft[];
  templates: Template[];
  signatures: Signature[];
}

export type WorkspaceView = "drafts" | "templates" | "signatures" | "settings";

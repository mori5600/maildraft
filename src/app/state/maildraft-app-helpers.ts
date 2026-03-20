import {
  createEmptySignature,
  type SignatureInput,
  toSignatureInput,
} from "../../modules/signatures/model";
import {
  createEmptyTemplate,
  type TemplateInput,
  toTemplateInput,
} from "../../modules/templates/model";
import type { TrashItem } from "../../modules/trash/model";
import { collectTrashItems } from "../../modules/trash/model";
import { getDefaultSignatureId } from "../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";

export interface WorkspaceSummary {
  count?: number;
  id: WorkspaceView;
  label: string;
}

export interface HydratedWorkspaceState {
  selectedSignatureId: string | null;
  selectedTemplateId: string | null;
  selectedTrashItemKey: string | null;
  signatureForm: SignatureInput;
  templateForm: TemplateInput;
}

export interface WorkspaceSummaryCounts {
  draftCount: number;
  memoCount: number;
  signatureCount: number;
  templateCount: number;
  trashItemCount: number;
}

export type ShortcutIntent =
  | { kind: "none" }
  | { kind: "focusSearch"; view: WorkspaceView }
  | { kind: "changeView"; view: WorkspaceView }
  | { kind: "createForView"; view: WorkspaceView }
  | { kind: "saveForView"; view: WorkspaceView }
  | { kind: "pinForView"; view: WorkspaceView }
  | { kind: "copyDraftPreview" };

export type CreateShortcutAction = "createDraft" | "createMemo" | "createTemplate" | "createSignature";
export type SaveShortcutAction =
  | "saveDraft"
  | "saveMemo"
  | "saveTemplate"
  | "saveSignature"
  | "saveLoggingSettings";
export type PinShortcutAction =
  | "toggleDraftPinned"
  | "toggleMemoPinned"
  | "toggleTemplatePinned"
  | "toggleSignaturePinned";

const CREATE_SHORTCUT_ACTIONS = {
  drafts: "createDraft",
  templates: "createTemplate",
  signatures: "createSignature",
  memo: "createMemo",
  trash: "createDraft",
  settings: "createDraft",
  help: "createDraft",
} satisfies Record<WorkspaceView, CreateShortcutAction>;

const SAVE_SHORTCUT_ACTIONS = {
  drafts: "saveDraft",
  templates: "saveTemplate",
  signatures: "saveSignature",
  memo: "saveMemo",
  trash: null,
  settings: "saveLoggingSettings",
  help: null,
} satisfies Record<WorkspaceView, SaveShortcutAction | null>;

const PIN_SHORTCUT_ACTIONS = {
  drafts: "toggleDraftPinned",
  memo: "toggleMemoPinned",
  templates: "toggleTemplatePinned",
  signatures: "toggleSignaturePinned",
  trash: null,
  settings: null,
  help: null,
} satisfies Record<WorkspaceView, PinShortcutAction | null>;

export function buildWorkspaceSummaries(
  counts: WorkspaceSummaryCounts,
): WorkspaceSummary[] {
  return [
    { id: "drafts", label: "下書き", count: counts.draftCount },
    { id: "templates", label: "テンプレート", count: counts.templateCount },
    { id: "signatures", label: "署名", count: counts.signatureCount },
    { id: "memo", label: "メモ", count: counts.memoCount },
    { id: "trash", label: "ゴミ箱", count: counts.trashItemCount },
    { id: "settings", label: "設定" },
    { id: "help", label: "ヘルプ" },
  ];
}

/**
 * Derives cross-workspace selection state after a full snapshot replacement.
 *
 * @remarks
 * Bootstrap and backup import replace the entire store at once. The app shell uses this helper to
 * reset template, signature, and trash selections to values that still exist in the new snapshot.
 */
export function buildHydratedWorkspaceState(snapshot: StoreSnapshot): HydratedWorkspaceState {
  const firstTemplate = snapshot.templates[0];
  const firstSignature = snapshot.signatures[0];

  return {
    selectedSignatureId: firstSignature?.id ?? null,
    selectedTemplateId: firstTemplate?.id ?? null,
    selectedTrashItemKey: collectTrashItems(snapshot.trash)[0]?.key ?? null,
    templateForm: firstTemplate
      ? toTemplateInput(firstTemplate)
      : createEmptyTemplate(getDefaultSignatureId(snapshot)),
    signatureForm: firstSignature
      ? toSignatureInput(firstSignature)
      : createEmptySignature(snapshot.signatures.length === 0),
  };
}

export function resolveShortcutIntent({
  currentView,
  key,
  shiftKey,
}: {
  currentView: WorkspaceView;
  key: string;
  shiftKey: boolean;
}): ShortcutIntent {
  const loweredKey = key.toLowerCase();

  if (!shiftKey && loweredKey === "k") {
    return { kind: "focusSearch", view: currentView };
  }

  if (!shiftKey && loweredKey === "1") {
    return { kind: "changeView", view: "drafts" };
  }

  if (!shiftKey && loweredKey === "2") {
    return { kind: "changeView", view: "templates" };
  }

  if (!shiftKey && loweredKey === "3") {
    return { kind: "changeView", view: "signatures" };
  }

  if (!shiftKey && loweredKey === "4") {
    return { kind: "changeView", view: "memo" };
  }

  if (!shiftKey && loweredKey === "5") {
    return { kind: "changeView", view: "trash" };
  }

  if (!shiftKey && loweredKey === "6") {
    return { kind: "changeView", view: "settings" };
  }

  if (!shiftKey && loweredKey === "7") {
    return { kind: "changeView", view: "help" };
  }

  if (!shiftKey && loweredKey === "n") {
    return { kind: "createForView", view: currentView };
  }

  if (!shiftKey && loweredKey === "s") {
    return { kind: "saveForView", view: currentView };
  }

  if (shiftKey && loweredKey === "p") {
    return { kind: "pinForView", view: currentView };
  }

  if (shiftKey && loweredKey === "c" && currentView === "drafts") {
    return { kind: "copyDraftPreview" };
  }

  return { kind: "none" };
}

export function resolveCreateShortcutAction(view: WorkspaceView): CreateShortcutAction {
  return CREATE_SHORTCUT_ACTIONS[view];
}

export function resolvePinShortcutAction(view: WorkspaceView): PinShortcutAction | null {
  return PIN_SHORTCUT_ACTIONS[view];
}

export function resolveSaveShortcutAction(view: WorkspaceView): SaveShortcutAction | null {
  return SAVE_SHORTCUT_ACTIONS[view];
}

export function resolveSelectedTrashItemKey(
  trashItems: TrashItem[],
  currentKey: string | null,
): string | null {
  if (trashItems.length === 0) {
    return null;
  }

  if (currentKey && trashItems.some((item) => item.key === currentKey)) {
    return currentKey;
  }

  return trashItems[0].key;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

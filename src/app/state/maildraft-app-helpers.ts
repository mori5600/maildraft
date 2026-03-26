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

export type CreateShortcutAction =
  | "createDraft"
  | "createMemo"
  | "createTemplate"
  | "createSignature";
export type SaveShortcutAction =
  | "saveDraft"
  | "saveMemo"
  | "saveTemplate"
  | "saveSignature"
  | "saveSettingsSection";
export type PinShortcutAction =
  | "toggleDraftPinned"
  | "toggleMemoPinned"
  | "toggleTemplatePinned"
  | "toggleSignaturePinned";

type ShortcutIntentResolver = (input: { currentView: WorkspaceView }) => ShortcutIntent;

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
  settings: "saveSettingsSection",
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

const CHANGE_VIEW_SHORTCUT_INTENT_RESOLVERS: Record<string, ShortcutIntentResolver> = {
  "1": () => ({ kind: "changeView", view: "drafts" }),
  "2": () => ({ kind: "changeView", view: "templates" }),
  "3": () => ({ kind: "changeView", view: "signatures" }),
  "4": () => ({ kind: "changeView", view: "memo" }),
  "5": () => ({ kind: "changeView", view: "trash" }),
  "6": () => ({ kind: "changeView", view: "settings" }),
  "7": () => ({ kind: "changeView", view: "help" }),
};

const COPY_SHORTCUT_INTENTS = {
  drafts: { kind: "copyDraftPreview" },
  templates: { kind: "none" },
  signatures: { kind: "none" },
  memo: { kind: "none" },
  trash: { kind: "none" },
  settings: { kind: "none" },
  help: { kind: "none" },
} satisfies Record<WorkspaceView, ShortcutIntent>;

const UNSHIFTED_SHORTCUT_INTENT_RESOLVERS: Record<string, ShortcutIntentResolver> = {
  k: ({ currentView }) => ({ kind: "focusSearch", view: currentView }),
  n: ({ currentView }) => ({ kind: "createForView", view: currentView }),
  s: ({ currentView }) => ({ kind: "saveForView", view: currentView }),
  ...CHANGE_VIEW_SHORTCUT_INTENT_RESOLVERS,
};

const SHIFTED_SHORTCUT_INTENT_RESOLVERS: Record<string, ShortcutIntentResolver> = {
  p: ({ currentView }) => ({ kind: "pinForView", view: currentView }),
  c: ({ currentView }) => COPY_SHORTCUT_INTENTS[currentView],
};

const SHORTCUT_INTENT_RESOLVER_SETS: Record<
  "shifted" | "unshifted",
  Record<string, ShortcutIntentResolver>
> = {
  shifted: SHIFTED_SHORTCUT_INTENT_RESOLVERS,
  unshifted: UNSHIFTED_SHORTCUT_INTENT_RESOLVERS,
};

export function buildWorkspaceSummaries(counts: WorkspaceSummaryCounts): WorkspaceSummary[] {
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
  const resolverSet = SHORTCUT_INTENT_RESOLVER_SETS[shiftKey ? "shifted" : "unshifted"];
  return resolverSet[loweredKey]?.({ currentView }) ?? { kind: "none" };
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

import { useEffect, useRef } from "react";

import type { WorkspaceView } from "../../shared/types/store";
import {
  resolveCreateShortcutAction,
  resolvePinShortcutAction,
  resolveSaveShortcutAction,
  resolveShortcutIntent,
  type ShortcutIntent,
} from "./maildraft-app-helpers";

export interface ShortcutActionSet {
  changeView: (nextView: WorkspaceView) => void;
  copyDraftPreview: () => Promise<void>;
  createDraft: () => void;
  createBlock: () => void;
  createMemo: () => void;
  createSignature: () => void;
  createTemplate: () => void;
  saveDraft: () => Promise<void>;
  saveBlock: () => Promise<void>;
  saveSettingsSection: () => Promise<void>;
  saveMemo: () => Promise<void>;
  saveSignature: () => Promise<void>;
  saveTemplate: () => Promise<void>;
  toggleDraftPinned: () => void;
  toggleMemoPinned: () => void;
  toggleSignaturePinned: () => void;
  toggleTemplatePinned: () => void;
}

interface AppShortcutsOptions {
  actions: ShortcutActionSet;
  isLoading: boolean;
  view: WorkspaceView;
}

type ActiveShortcutIntent = Exclude<ShortcutIntent, { kind: "none" }>;

type ShortcutIntentHandlerMap = {
  [Kind in ActiveShortcutIntent["kind"]]: (
    actions: ShortcutActionSet,
    shortcutIntent: Extract<ActiveShortcutIntent, { kind: Kind }>,
  ) => void | Promise<void>;
};

function focusWorkspaceSearch(view: WorkspaceView) {
  const searchInput = document.querySelector<HTMLInputElement>(`[data-maildraft-search="${view}"]`);

  if (!searchInput) {
    return;
  }

  searchInput.focus();
  searchInput.select();
}

function runCreateShortcut(actions: ShortcutActionSet, view: WorkspaceView) {
  actions[resolveCreateShortcutAction(view)]();
}

async function runSaveShortcut(actions: ShortcutActionSet, view: WorkspaceView) {
  const action = resolveSaveShortcutAction(view);
  if (action) {
    await actions[action]();
  }
}

function runPinShortcut(actions: ShortcutActionSet, view: WorkspaceView) {
  const action = resolvePinShortcutAction(view);
  if (action) {
    actions[action]();
  }
}

const SHORTCUT_INTENT_HANDLERS = {
  focusSearch: (_actions, shortcutIntent) => {
    focusWorkspaceSearch(shortcutIntent.view);
  },
  changeView: (actions, shortcutIntent) => {
    actions.changeView(shortcutIntent.view);
  },
  createForView: (actions, shortcutIntent) => {
    runCreateShortcut(actions, shortcutIntent.view);
  },
  saveForView: (actions, shortcutIntent) => runSaveShortcut(actions, shortcutIntent.view),
  pinForView: (actions, shortcutIntent) => {
    runPinShortcut(actions, shortcutIntent.view);
  },
  copyDraftPreview: (actions) => actions.copyDraftPreview(),
} satisfies ShortcutIntentHandlerMap;

function runShortcutIntent(actions: ShortcutActionSet, shortcutIntent: ActiveShortcutIntent) {
  return (
    SHORTCUT_INTENT_HANDLERS[shortcutIntent.kind] as (
      currentActions: ShortcutActionSet,
      currentShortcutIntent: ActiveShortcutIntent,
    ) => void | Promise<void>
  )(actions, shortcutIntent);
}

/**
 * Registers app-wide keyboard shortcuts against the current workspace and loading state.
 *
 * @remarks
 * The DOM listener is attached once. Mutable refs keep the latest view, loading flag, and action
 * set available without rebinding the listener on every render.
 */
export function useAppShortcuts({ actions, isLoading, view }: AppShortcutsOptions) {
  const viewRef = useRef(view);
  const isLoadingRef = useRef(isLoading);
  const shortcutActionsRef = useRef<ShortcutActionSet | null>(actions);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    shortcutActionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      ) {
        return;
      }

      const currentActions = shortcutActionsRef.current;
      if (!currentActions || isLoadingRef.current) {
        return;
      }

      const currentView = viewRef.current;
      const shortcutIntent = resolveShortcutIntent({
        currentView,
        key: event.key,
        shiftKey: event.shiftKey,
      });
      if (shortcutIntent.kind === "none") {
        return;
      }

      event.preventDefault();
      void runShortcutIntent(currentActions, shortcutIntent);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}

import { useEffect, useRef } from "react";

import type { WorkspaceView } from "../../shared/types/store";
import {
  resolveCreateShortcutAction,
  resolvePinShortcutAction,
  resolveSaveShortcutAction,
  resolveShortcutIntent,
} from "./maildraft-app-helpers";

export interface ShortcutActionSet {
  changeView: (nextView: WorkspaceView) => void;
  copyDraftPreview: () => Promise<void>;
  createDraft: () => void;
  createMemo: () => void;
  createSignature: () => void;
  createTemplate: () => void;
  saveDraft: () => Promise<void>;
  saveLoggingSettings: () => Promise<void>;
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

      if (shortcutIntent.kind === "focusSearch") {
        focusWorkspaceSearch(shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "changeView") {
        currentActions.changeView(shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "createForView") {
        runCreateShortcut(currentActions, shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "saveForView") {
        void runSaveShortcut(currentActions, shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "pinForView") {
        runPinShortcut(currentActions, shortcutIntent.view);
        return;
      }

      void currentActions.copyDraftPreview();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}

import { confirm } from "@tauri-apps/plugin-dialog";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import type { DraftWorkspaceHandle } from "../../modules/drafts/ui/DraftWorkspaceScreen";
import type { LoggingSettingsSnapshot } from "../../modules/settings/model";
import { useSettingsWorkspaceState } from "../../modules/settings/state/use-settings-workspace-state";
import { useSignatureWorkspaceState } from "../../modules/signatures/state/use-signature-workspace-state";
import { useTemplateWorkspaceState } from "../../modules/templates/state/use-template-workspace-state";
import { collectTrashItems, type TrashItem } from "../../modules/trash/model";
import { maildraftApi } from "../../shared/api/maildraft-api";
import {
  applyTheme,
  type AppTheme,
  persistTheme,
  resolveInitialTheme,
} from "../../shared/lib/theme";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";
import {
  buildWorkspaceSummaries,
  resolveCreateShortcutAction,
  resolvePinShortcutAction,
  resolveSaveShortcutAction,
  resolveSelectedTrashItemKey,
  resolveShortcutIntent,
  toErrorMessage,
} from "./maildraft-app-helpers";

const EMPTY_SNAPSHOT: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  templates: [],
  signatures: [],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

interface ShortcutActionSet {
  changeView: (nextView: WorkspaceView) => void;
  copyDraftPreview: () => Promise<void>;
  createDraft: () => void;
  createSignature: () => void;
  createTemplate: () => void;
  saveDraft: () => Promise<void>;
  saveLoggingSettings: () => Promise<void>;
  saveSignature: () => Promise<void>;
  saveTemplate: () => Promise<void>;
  toggleDraftPinned: () => void;
  toggleSignaturePinned: () => void;
  toggleTemplatePinned: () => void;
}

export function useMaildraftApp(draftWorkspaceRef: RefObject<DraftWorkspaceHandle | null>) {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("ローカル保存の準備をしています。");
  const [view, setViewState] = useState<WorkspaceView>("drafts");
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme());
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [selectedTrashItemKey, setSelectedTrashItemKey] = useState<string | null>(null);

  const viewRef = useRef(view);
  const isLoadingRef = useRef(isLoading);
  const hydrateAllRef = useRef<(snapshot: StoreSnapshot) => void>(() => undefined);
  const hydrateLoggingSettingsRef =
    useRef<(nextLoggingSettings: LoggingSettingsSnapshot) => void>(() => undefined);
  const shortcutActionsRef = useRef<ShortcutActionSet | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const trashItems = useMemo(() => collectTrashItems(snapshot.trash), [snapshot.trash]);
  const views = useMemo(
    () =>
      buildWorkspaceSummaries({
        draftCount: snapshot.drafts.length,
        signatureCount: snapshot.signatures.length,
        templateCount: snapshot.templates.length,
        trashItemCount: trashItems.length,
      }),
    [
      snapshot.drafts.length,
      snapshot.signatures.length,
      snapshot.templates.length,
      trashItems.length,
    ],
  );

  useEffect(() => {
    const nextSelectedTrashItemKey = resolveSelectedTrashItemKey(
      trashItems,
      selectedTrashItemKey,
    );
    if (nextSelectedTrashItemKey !== selectedTrashItemKey) {
      setSelectedTrashItemKey(nextSelectedTrashItemKey);
    }
  }, [selectedTrashItemKey, trashItems]);

  const templateState = useTemplateWorkspaceState({
    onClearError: () => setError(null),
    onError: setError,
    onFlushDraft: () => draftWorkspaceRef.current?.flushPendingDraft(),
    onNotice: setNotice,
    onOpenDraftInput: (input) => draftWorkspaceRef.current?.openDraftInput(input),
    onSnapshotChange: setSnapshot,
    onTrashItemSelect: setSelectedTrashItemKey,
    onViewChange: setViewState,
    snapshot,
  });
  const signatureState = useSignatureWorkspaceState({
    onClearError: () => setError(null),
    onError: setError,
    onFlushDraft: () => draftWorkspaceRef.current?.flushPendingDraft(),
    onNotice: setNotice,
    onSignatureSnapshotChange: templateState.syncTemplateSignatureId,
    onSnapshotChange: setSnapshot,
    onTrashItemSelect: setSelectedTrashItemKey,
    onViewChange: setViewState,
    snapshot,
  });
  const settingsState = useSettingsWorkspaceState({
    onBackupImported: (nextSnapshot) => {
      hydrateAll(nextSnapshot);
      draftWorkspaceRef.current?.hydrateSnapshot(nextSnapshot);
    },
    onClearError: () => setError(null),
    onError: setError,
    onNotice: setNotice,
  });

  function hydrateAll(nextSnapshot: StoreSnapshot) {
    setSnapshot(nextSnapshot);
    templateState.hydrateTemplateState(nextSnapshot);
    signatureState.hydrateSignatureState(nextSnapshot);
    setSelectedTrashItemKey(collectTrashItems(nextSnapshot.trash)[0]?.key ?? null);
  }

  hydrateAllRef.current = hydrateAll;
  hydrateLoggingSettingsRef.current = settingsState.hydrateLoggingSettings;

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const nextSnapshot = await maildraftApi.loadSnapshot();
        const nextLoggingSettings = await maildraftApi.loadLoggingSettings();
        hydrateAllRef.current(nextSnapshot);
        hydrateLoggingSettingsRef.current(nextLoggingSettings);
        setNotice("ローカルデータと診断設定を読み込みました。");
      } catch (loadError) {
        setError(toErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function changeView(nextView: WorkspaceView) {
    if (viewRef.current === "drafts" && nextView !== "drafts") {
      draftWorkspaceRef.current?.flushPendingDraft();
    }

    setViewState(nextView);
  }

  function createDraft() {
    draftWorkspaceRef.current?.createDraft();
    setViewState("drafts");
  }

  async function saveDraft() {
    await draftWorkspaceRef.current?.saveDraft();
  }

  async function copyDraftPreview() {
    await draftWorkspaceRef.current?.copyPreview();
  }

  function toggleDraftPinned() {
    draftWorkspaceRef.current?.togglePinned();
  }

  function selectTrashItem(key: string) {
    setSelectedTrashItemKey(key);
    setViewState("trash");
  }

  async function restoreTrashItem(item: TrashItem) {
    try {
      setError(null);

      if (item.kind === "draft") {
        const nextSnapshot = await maildraftApi.restoreDraftFromTrash(item.draft.id);
        setSnapshot(nextSnapshot);
        draftWorkspaceRef.current?.openDraftById(item.draft.id, nextSnapshot);
        setViewState("drafts");
        setNotice("下書きをゴミ箱から復元しました。");
        return;
      }

      if (item.kind === "template") {
        const nextSnapshot = await maildraftApi.restoreTemplateFromTrash(item.template.id);
        setSnapshot(nextSnapshot);
        templateState.hydrateTemplateState(nextSnapshot, item.template.id);
        setViewState("templates");
        setNotice("テンプレートをゴミ箱から復元しました。");
        return;
      }

      const nextSnapshot = await maildraftApi.restoreSignatureFromTrash(item.signature.id);
      setSnapshot(nextSnapshot);
      signatureState.hydrateSignatureState(nextSnapshot, item.signature.id);
      templateState.syncTemplateSignatureId(nextSnapshot);
      setViewState("signatures");
      setNotice("署名をゴミ箱から復元しました。");
    } catch (restoreError) {
      setError(toErrorMessage(restoreError));
    }
  }

  async function permanentlyDeleteTrashItem(item: TrashItem) {
    const confirmed = await confirm("この項目を完全に削除します。元に戻せません。続けますか？", {
      title: "MailDraft",
      kind: "warning",
      okLabel: "完全削除",
      cancelLabel: "キャンセル",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      if (item.kind === "draft") {
        const nextSnapshot = await maildraftApi.permanentlyDeleteDraftFromTrash(item.draft.id);
        setSnapshot(nextSnapshot);
        setNotice("下書きを完全に削除しました。");
        return;
      }

      if (item.kind === "template") {
        const nextSnapshot = await maildraftApi.permanentlyDeleteTemplateFromTrash(
          item.template.id,
        );
        setSnapshot(nextSnapshot);
        setNotice("テンプレートを完全に削除しました。");
        return;
      }

      const nextSnapshot = await maildraftApi.permanentlyDeleteSignatureFromTrash(
        item.signature.id,
      );
      setSnapshot(nextSnapshot);
      templateState.syncTemplateSignatureId(nextSnapshot);
      setNotice("署名を完全に削除しました。");
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    }
  }

  async function emptyTrash() {
    const confirmed = await confirm("ゴミ箱を空にします。元に戻せません。続けますか？", {
      title: "MailDraft",
      kind: "warning",
      okLabel: "ゴミ箱を空にする",
      cancelLabel: "キャンセル",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.emptyTrash();
      setSnapshot(nextSnapshot);
      setSelectedTrashItemKey(null);
      templateState.syncTemplateSignatureId(nextSnapshot);
      setNotice("ゴミ箱を空にしました。");
    } catch (emptyError) {
      setError(toErrorMessage(emptyError));
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setNotice(
      nextTheme === "dark" ? "ダーク表示に切り替えました。" : "ライト表示に切り替えました。",
    );
  }

  function toggleWhitespace() {
    setShowWhitespace((current) => !current);
  }

  useEffect(() => {
    shortcutActionsRef.current = {
      changeView,
      copyDraftPreview,
      createDraft,
      createSignature: signatureState.createSignature,
      createTemplate: templateState.createTemplate,
      saveDraft,
      saveLoggingSettings: settingsState.saveLoggingSettings,
      saveSignature: signatureState.saveSignature,
      saveTemplate: templateState.saveTemplate,
      toggleDraftPinned,
      toggleSignaturePinned: signatureState.toggleSignaturePinned,
      toggleTemplatePinned: templateState.toggleTemplatePinned,
    };
  });

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

      const actions = shortcutActionsRef.current;
      if (!actions || isLoadingRef.current) {
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
        actions.changeView(shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "createForView") {
        runCreateShortcut(actions, shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "saveForView") {
        void runSaveShortcut(actions, shortcutIntent.view);
        return;
      }

      if (shortcutIntent.kind === "pinForView") {
        runPinShortcut(actions, shortcutIntent.view);
        return;
      }

      void actions.copyDraftPreview();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return {
    draftWorkspaceProps: {
      onClearError: () => setError(null),
      onError: (message: string) => setError(message),
      onNotice: (message: string) => setNotice(message),
      onSnapshotChange: setSnapshot,
      showWhitespace,
      snapshot,
    },
    error,
    isLoading,
    notice,
    settingsWorkspaceProps: settingsState.settingsWorkspaceProps,
    showWhitespace,
    signatureWorkspaceProps: {
      ...signatureState.signatureWorkspaceProps,
      showWhitespace,
    },
    templateWorkspaceProps: {
      ...templateState.templateWorkspaceProps,
      showWhitespace,
    },
    theme,
    toggleTheme,
    toggleWhitespace,
    trashWorkspaceProps: {
      items: trashItems,
      onDeleteItemPermanently: permanentlyDeleteTrashItem,
      onEmptyTrash: emptyTrash,
      onRestoreItem: restoreTrashItem,
      onSelectItem: selectTrashItem,
      selectedItemKey: selectedTrashItemKey,
      showWhitespace,
      signatures: snapshot.signatures,
      trashedSignatures: snapshot.trash.signatures,
    },
    view,
    views,
    setView: changeView,
  };
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

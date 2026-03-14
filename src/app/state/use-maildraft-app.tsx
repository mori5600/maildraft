import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import { createDraftFromTemplate, createDraftFromTemplateInput } from "../../modules/drafts/model";
import type { DraftWorkspaceHandle } from "../../modules/drafts/ui/DraftWorkspaceScreen";
import { renderTemplatePreview } from "../../modules/renderer/render-draft";
import {
  createDefaultLoggingSettingsSnapshot,
  type LogEntrySnapshot,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  RECENT_LOG_LIMIT,
  toLoggingSettingsInput,
} from "../../modules/settings/model";
import {
  createEmptySignature,
  duplicateSignatureInput,
  type SignatureInput,
  toSignatureInput,
} from "../../modules/signatures/model";
import {
  createEmptyTemplate,
  duplicateTemplateInput,
  type TemplateInput,
  toTemplateInput,
} from "../../modules/templates/model";
import {
  buildTrashItemKey,
  collectTrashItems,
  findTrashSignature,
  type TrashItem,
} from "../../modules/trash/model";
import { maildraftApi } from "../../shared/api/maildraft-api";
import { BACKUP_FILE_FILTER, createBackupDefaultFileName } from "../../shared/lib/backup";
import {
  type SignatureSortOption,
  sortSignatures,
  sortTemplates,
  type TemplateSortOption,
} from "../../shared/lib/list-sort";
import { matchesSearchQuery } from "../../shared/lib/search";
import {
  getDefaultSignatureId,
  pickKnownSignatureId,
  pickSignatureInput,
  pickTemplateInput,
} from "../../shared/lib/store-snapshot";
import {
  applyTheme,
  type AppTheme,
  persistTheme,
  resolveInitialTheme,
} from "../../shared/lib/theme";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";

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
const DEFAULT_LOGGING_SETTINGS = createDefaultLoggingSettingsSnapshot();

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

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

export function useMaildraftApp(draftWorkspaceRef: RefObject<DraftWorkspaceHandle | null>) {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(EMPTY_SNAPSHOT);
  const [loggingSettings, setLoggingSettings] =
    useState<LoggingSettingsSnapshot>(DEFAULT_LOGGING_SETTINGS);
  const [recentLogs, setRecentLogs] = useState<LogEntrySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecentLogs, setIsLoadingRecentLogs] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("ローカル保存の準備をしています。");
  const [view, setViewState] = useState<WorkspaceView>("drafts");
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme());
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateSort, setTemplateSort] = useState<TemplateSortOption>("recent");
  const [signatureSearchQuery, setSignatureSearchQuery] = useState("");
  const [signatureSort, setSignatureSort] = useState<SignatureSortOption>("recent");

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [selectedTrashItemKey, setSelectedTrashItemKey] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState<TemplateInput>(() => createEmptyTemplate(null));
  const [signatureForm, setSignatureForm] = useState<SignatureInput>(() =>
    createEmptySignature(true),
  );
  const [loggingForm, setLoggingForm] = useState<LoggingSettingsInput>(() =>
    toLoggingSettingsInput(DEFAULT_LOGGING_SETTINGS),
  );

  const viewRef = useRef(view);
  const isLoadingRef = useRef(isLoading);
  const shortcutActionsRef = useRef<ShortcutActionSet | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const nextSnapshot = await maildraftApi.loadSnapshot();
        const nextLoggingSettings = await maildraftApi.loadLoggingSettings();
        hydrateAll(nextSnapshot);
        hydrateLoggingSettings(nextLoggingSettings);
        setNotice("ローカルデータと診断設定を読み込みました。");
      } catch (loadError) {
        setError(asMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const selectedTemplateSignature = useMemo(
    () =>
      findTrashSignature(snapshot.signatures, snapshot.trash.signatures, templateForm.signatureId),
    [snapshot.signatures, snapshot.trash.signatures, templateForm.signatureId],
  );
  const templatePreviewText = useMemo(
    () => renderTemplatePreview(templateForm, selectedTemplateSignature),
    [selectedTemplateSignature, templateForm],
  );
  const trashItems = useMemo(() => collectTrashItems(snapshot.trash), [snapshot.trash]);
  const filteredTemplates = useMemo(
    () =>
      sortTemplates(
        snapshot.templates.filter((template) =>
          matchesSearchQuery(templateSearchQuery, [
            template.name,
            template.subject,
            template.recipient,
            template.opening,
            template.body,
            template.closing,
          ]),
        ),
        templateSort,
      ),
    [snapshot.templates, templateSearchQuery, templateSort],
  );
  const filteredSignatures = useMemo(
    () =>
      sortSignatures(
        snapshot.signatures.filter((signature) =>
          matchesSearchQuery(signatureSearchQuery, [signature.name, signature.body]),
        ),
        signatureSort,
      ),
    [signatureSearchQuery, signatureSort, snapshot.signatures],
  );
  const views = useMemo(
    () => [
      { id: "drafts" as const, label: "下書き", count: snapshot.drafts.length },
      { id: "templates" as const, label: "テンプレート", count: snapshot.templates.length },
      { id: "signatures" as const, label: "署名", count: snapshot.signatures.length },
      { id: "trash" as const, label: "ゴミ箱", count: trashItems.length },
      { id: "settings" as const, label: "設定" },
      { id: "help" as const, label: "ヘルプ" },
    ],
    [
      snapshot.drafts.length,
      snapshot.signatures.length,
      snapshot.templates.length,
      trashItems.length,
    ],
  );

  useEffect(() => {
    if (trashItems.length === 0) {
      setSelectedTrashItemKey(null);
      return;
    }

    if (selectedTrashItemKey && trashItems.some((item) => item.key === selectedTrashItemKey)) {
      return;
    }

    setSelectedTrashItemKey(trashItems[0].key);
  }, [selectedTrashItemKey, trashItems]);

  function hydrateAll(nextSnapshot: StoreSnapshot) {
    setSnapshot(nextSnapshot);

    const firstTemplate = nextSnapshot.templates[0];
    const firstSignature = nextSnapshot.signatures[0];

    setSelectedTemplateId(firstTemplate?.id ?? null);
    setSelectedSignatureId(firstSignature?.id ?? null);
    setSelectedTrashItemKey(collectTrashItems(nextSnapshot.trash)[0]?.key ?? null);

    setTemplateForm(
      firstTemplate
        ? toTemplateInput(firstTemplate)
        : createEmptyTemplate(getDefaultSignatureId(nextSnapshot)),
    );
    setSignatureForm(
      firstSignature
        ? toSignatureInput(firstSignature)
        : createEmptySignature(nextSnapshot.signatures.length === 0),
    );
  }

  function hydrateLoggingSettings(nextLoggingSettings: LoggingSettingsSnapshot) {
    setLoggingSettings(nextLoggingSettings);
    setLoggingForm(toLoggingSettingsInput(nextLoggingSettings));
  }

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

  function selectTemplate(id: string) {
    draftWorkspaceRef.current?.flushPendingDraft();

    const template = snapshot.templates.find((item) => item.id === id);
    if (!template) {
      return;
    }

    setSelectedTemplateId(id);
    setTemplateForm(toTemplateInput(template));
    setViewState("templates");
  }

  function createTemplate() {
    draftWorkspaceRef.current?.flushPendingDraft();
    setSelectedTemplateId(null);
    setTemplateForm(createEmptyTemplate(getDefaultSignatureId(snapshot)));
    setViewState("templates");
    setNotice("新しいテンプレートを作成しています。");
  }

  function changeTemplate<K extends keyof TemplateInput>(field: K, value: TemplateInput[K]) {
    setTemplateForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleTemplatePinned() {
    setTemplateForm((current) => ({
      ...current,
      isPinned: !current.isPinned,
    }));
  }

  function changeTemplateSearchQuery(value: string) {
    setTemplateSearchQuery(value);
  }

  function changeTemplateSort(value: TemplateSortOption) {
    setTemplateSort(value);
  }

  async function saveTemplate() {
    try {
      setError(null);
      const nextSnapshot = await maildraftApi.saveTemplate(templateForm);
      setSnapshot(nextSnapshot);
      setSelectedTemplateId(templateForm.id);
      setTemplateForm(pickTemplateInput(nextSnapshot, templateForm.id));
      setNotice("テンプレートを保存しました。");
    } catch (saveError) {
      setError(asMessage(saveError));
    }
  }

  async function duplicateTemplate() {
    if (!selectedTemplateId) {
      return;
    }

    const duplicate = duplicateTemplateInput(templateForm);

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.saveTemplate(duplicate);
      setSnapshot(nextSnapshot);
      setSelectedTemplateId(duplicate.id);
      setTemplateForm(pickTemplateInput(nextSnapshot, duplicate.id));
      setNotice("テンプレートを複製しました。");
    } catch (duplicateError) {
      setError(asMessage(duplicateError));
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) {
      createTemplate();
      return;
    }

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.deleteTemplate(selectedTemplateId);
      setSnapshot(nextSnapshot);
      const nextSelectedId = nextSnapshot.templates[0]?.id ?? null;
      setSelectedTemplateId(nextSelectedId);
      setTemplateForm(pickTemplateInput(nextSnapshot, nextSelectedId));
      setSelectedTrashItemKey(buildTrashItemKey("template", selectedTemplateId));
      setNotice("テンプレートをゴミ箱に移動しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
    }
  }

  function startDraftFromTemplate() {
    const template = snapshot.templates.find((item) => item.id === templateForm.id);
    const nextDraft = template
      ? createDraftFromTemplate(template, getDefaultSignatureId(snapshot))
      : createDraftFromTemplateInput(templateForm, getDefaultSignatureId(snapshot));

    draftWorkspaceRef.current?.openDraftInput(nextDraft);
    setViewState("drafts");
    setNotice(
      template
        ? `テンプレート「${template.name}」から新しい下書きを起こしました。`
        : "未保存のテンプレートから新しい下書きを起こしました。",
    );
  }

  function selectSignature(id: string) {
    draftWorkspaceRef.current?.flushPendingDraft();

    const signature = snapshot.signatures.find((item) => item.id === id);
    if (!signature) {
      return;
    }

    setSelectedSignatureId(id);
    setSignatureForm(toSignatureInput(signature));
    setViewState("signatures");
  }

  function createSignature() {
    draftWorkspaceRef.current?.flushPendingDraft();
    setSelectedSignatureId(null);
    setSignatureForm(createEmptySignature(snapshot.signatures.length === 0));
    setViewState("signatures");
    setNotice("新しい署名を作成しています。");
  }

  function changeSignature<K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) {
    setSignatureForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSignaturePinned() {
    setSignatureForm((current) => ({
      ...current,
      isPinned: !current.isPinned,
    }));
  }

  function changeSignatureSearchQuery(value: string) {
    setSignatureSearchQuery(value);
  }

  function changeSignatureSort(value: SignatureSortOption) {
    setSignatureSort(value);
  }

  async function saveSignature() {
    try {
      setError(null);
      const nextSnapshot = await maildraftApi.saveSignature(signatureForm);
      setSnapshot(nextSnapshot);
      setSelectedSignatureId(signatureForm.id);
      setSignatureForm(pickSignatureInput(nextSnapshot, signatureForm.id));
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
      setNotice("署名を保存しました。");
    } catch (saveError) {
      setError(asMessage(saveError));
    }
  }

  async function duplicateSignature() {
    if (!selectedSignatureId) {
      return;
    }

    const duplicate = duplicateSignatureInput(signatureForm);

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.saveSignature(duplicate);
      setSnapshot(nextSnapshot);
      setSelectedSignatureId(duplicate.id);
      setSignatureForm(pickSignatureInput(nextSnapshot, duplicate.id));
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
      setNotice("署名を複製しました。");
    } catch (duplicateError) {
      setError(asMessage(duplicateError));
    }
  }

  async function deleteSignature() {
    if (!selectedSignatureId) {
      createSignature();
      return;
    }

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.deleteSignature(selectedSignatureId);
      setSnapshot(nextSnapshot);
      const nextSelectedId = nextSnapshot.signatures[0]?.id ?? null;
      setSelectedSignatureId(nextSelectedId);
      setSignatureForm(pickSignatureInput(nextSnapshot, nextSelectedId));
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
      setSelectedTrashItemKey(buildTrashItemKey("signature", selectedSignatureId));
      setNotice("署名をゴミ箱に移動しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
    }
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
        setSelectedTemplateId(item.template.id);
        setTemplateForm(pickTemplateInput(nextSnapshot, item.template.id));
        setViewState("templates");
        setNotice("テンプレートをゴミ箱から復元しました。");
        return;
      }

      const nextSnapshot = await maildraftApi.restoreSignatureFromTrash(item.signature.id);
      setSnapshot(nextSnapshot);
      setSelectedSignatureId(item.signature.id);
      setSignatureForm(pickSignatureInput(nextSnapshot, item.signature.id));
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
      setViewState("signatures");
      setNotice("署名をゴミ箱から復元しました。");
    } catch (restoreError) {
      setError(asMessage(restoreError));
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
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
      setNotice("署名を完全に削除しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
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
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
      setNotice("ゴミ箱を空にしました。");
    } catch (emptyError) {
      setError(asMessage(emptyError));
    }
  }

  function changeLogging<K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) {
    setLoggingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveLoggingSettings() {
    try {
      setError(null);
      const nextLoggingSettings = await maildraftApi.saveLoggingSettings(loggingForm);
      hydrateLoggingSettings(nextLoggingSettings);
      setNotice("ログ設定を保存しました。");
    } catch (saveError) {
      setError(asMessage(saveError));
    }
  }

  async function clearLogs() {
    try {
      setError(null);
      const nextLoggingSettings = await maildraftApi.clearLogs();
      hydrateLoggingSettings(nextLoggingSettings);
      setRecentLogs([]);
      setNotice("診断ログを削除しました。");
    } catch (clearError) {
      setError(asMessage(clearError));
    }
  }

  async function refreshRecentLogs({ silent = false }: { silent?: boolean } = {}) {
    try {
      if (!silent) {
        setError(null);
      }

      setIsLoadingRecentLogs(true);
      const nextRecentLogs = await maildraftApi.loadRecentLogs(RECENT_LOG_LIMIT);
      setRecentLogs(nextRecentLogs);

      if (!silent) {
        setNotice("最近のログを更新しました。");
      }
    } catch (loadError) {
      setError(asMessage(loadError));
    } finally {
      setIsLoadingRecentLogs(false);
    }
  }

  async function exportBackup() {
    try {
      setError(null);
      setIsExportingBackup(true);
      const path = await save({
        title: "MailDraft バックアップを書き出す",
        defaultPath: createBackupDefaultFileName(),
        filters: [BACKUP_FILE_FILTER],
      });

      if (!path) {
        return;
      }

      await maildraftApi.exportBackup(path);
      setNotice("バックアップを書き出しました。");
    } catch (exportError) {
      setError(asMessage(exportError));
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function importBackup() {
    try {
      setError(null);
      const confirmed = await confirm(
        "バックアップを読み込むと、現在の下書き・テンプレート・署名・履歴を置き換えます。続けますか？",
        {
          title: "MailDraft",
          kind: "warning",
          okLabel: "読み込む",
          cancelLabel: "キャンセル",
        },
      );

      if (!confirmed) {
        return;
      }

      setIsImportingBackup(true);
      const selected = await open({
        title: "MailDraft バックアップを読み込む",
        multiple: false,
        filters: [BACKUP_FILE_FILTER],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const imported = await maildraftApi.importBackup(selected);
      hydrateAll(imported.snapshot);
      draftWorkspaceRef.current?.hydrateSnapshot(imported.snapshot);
      hydrateLoggingSettings(imported.loggingSettings);
      setNotice("バックアップを読み込みました。");
    } catch (importError) {
      setError(asMessage(importError));
    } finally {
      setIsImportingBackup(false);
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
      createSignature,
      createTemplate,
      saveDraft,
      saveLoggingSettings,
      saveSignature,
      saveTemplate,
      toggleDraftPinned,
      toggleSignaturePinned,
      toggleTemplatePinned,
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

      const key = event.key.toLowerCase();
      const currentView = viewRef.current;

      if (!event.shiftKey && key === "k") {
        event.preventDefault();
        focusWorkspaceSearch(currentView);
        return;
      }

      if (!event.shiftKey && key === "1") {
        event.preventDefault();
        actions.changeView("drafts");
        return;
      }

      if (!event.shiftKey && key === "2") {
        event.preventDefault();
        actions.changeView("templates");
        return;
      }

      if (!event.shiftKey && key === "3") {
        event.preventDefault();
        actions.changeView("signatures");
        return;
      }

      if (!event.shiftKey && key === "4") {
        event.preventDefault();
        actions.changeView("trash");
        return;
      }

      if (!event.shiftKey && key === "5") {
        event.preventDefault();
        actions.changeView("settings");
        return;
      }

      if (!event.shiftKey && key === "6") {
        event.preventDefault();
        actions.changeView("help");
        return;
      }

      if (!event.shiftKey && key === "n") {
        event.preventDefault();
        runCreateShortcut(actions, currentView);
        return;
      }

      if (!event.shiftKey && key === "s") {
        event.preventDefault();
        void runSaveShortcut(actions, currentView);
        return;
      }

      if (event.shiftKey && key === "p") {
        event.preventDefault();
        runPinShortcut(actions, currentView);
        return;
      }

      if (event.shiftKey && key === "c" && currentView === "drafts") {
        event.preventDefault();
        void actions.copyDraftPreview();
      }
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
    settingsWorkspaceProps: {
      isExportingBackup,
      isImportingBackup,
      isLoadingRecentLogs,
      loggingForm,
      loggingSettings,
      onChangeLogging: changeLogging,
      onClearLogs: clearLogs,
      onExportBackup: exportBackup,
      onImportBackup: importBackup,
      onRefreshRecentLogs: refreshRecentLogs,
      onSaveLoggingSettings: saveLoggingSettings,
      recentLogs,
    },
    showWhitespace,
    signatureWorkspaceProps: {
      canDuplicate: selectedSignatureId !== null,
      onChangeSearchQuery: changeSignatureSearchQuery,
      onChangeSignature: changeSignature,
      onChangeSort: changeSignatureSort,
      onCreateSignature: createSignature,
      onDeleteSignature: deleteSignature,
      onDuplicateSignature: duplicateSignature,
      onSaveSignature: saveSignature,
      onSelectSignature: selectSignature,
      onTogglePinned: toggleSignaturePinned,
      searchQuery: signatureSearchQuery,
      selectedSignatureId,
      showWhitespace,
      signatureForm,
      signatures: filteredSignatures,
      sort: signatureSort,
      totalSignatureCount: snapshot.signatures.length,
    },
    templateWorkspaceProps: {
      canDuplicate: selectedTemplateId !== null,
      onChangeSearchQuery: changeTemplateSearchQuery,
      onChangeSort: changeTemplateSort,
      onChangeTemplate: changeTemplate,
      onCreateTemplate: createTemplate,
      onDeleteTemplate: deleteTemplate,
      onDuplicateTemplate: duplicateTemplate,
      onSaveTemplate: saveTemplate,
      onSelectTemplate: selectTemplate,
      onStartDraftFromTemplate: startDraftFromTemplate,
      onTogglePinned: toggleTemplatePinned,
      previewText: templatePreviewText,
      searchQuery: templateSearchQuery,
      selectedTemplateId,
      showWhitespace,
      signatures: snapshot.signatures,
      sort: templateSort,
      templateForm,
      templates: filteredTemplates,
      totalTemplateCount: snapshot.templates.length,
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
  switch (view) {
    case "drafts":
      actions.createDraft();
      return;
    case "templates":
      actions.createTemplate();
      return;
    case "signatures":
      actions.createSignature();
      return;
    case "trash":
    case "settings":
    case "help":
      actions.createDraft();
      return;
  }
}

async function runSaveShortcut(actions: ShortcutActionSet, view: WorkspaceView) {
  switch (view) {
    case "drafts":
      await actions.saveDraft();
      return;
    case "templates":
      await actions.saveTemplate();
      return;
    case "signatures":
      await actions.saveSignature();
      return;
    case "settings":
      await actions.saveLoggingSettings();
      return;
    case "trash":
    case "help":
      return;
  }
}

function runPinShortcut(actions: ShortcutActionSet, view: WorkspaceView) {
  switch (view) {
    case "drafts":
      actions.toggleDraftPinned();
      return;
    case "templates":
      actions.toggleTemplatePinned();
      return;
    case "signatures":
      actions.toggleSignaturePinned();
      return;
    case "trash":
    case "settings":
    case "help":
      return;
  }
}

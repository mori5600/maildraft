import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import {
  applyTemplateToDraft,
  createDraftFromTemplate,
  createEmptyDraft,
  draftHasMeaningfulContent,
  type DraftInput,
  draftInputsEqual,
  duplicateDraftInput,
  toDraftInput,
} from "../../modules/drafts/model";
import { DraftWorkspace } from "../../modules/drafts/ui/DraftWorkspace";
import { HelpWorkspace } from "../../modules/help/ui/HelpWorkspace";
import {
  collectDraftChecks,
  collectDraftVariableNames,
  renderDraftPreview,
  renderDraftSubject,
  renderTemplatePreview,
} from "../../modules/renderer/render-draft";
import {
  createDefaultLoggingSettingsSnapshot,
  type LogEntrySnapshot,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  RECENT_LOG_LIMIT,
  toLoggingSettingsInput,
} from "../../modules/settings/model";
import { SettingsWorkspace } from "../../modules/settings/ui/SettingsWorkspace";
import {
  createEmptySignature,
  duplicateSignatureInput,
  type SignatureInput,
  toSignatureInput,
} from "../../modules/signatures/model";
import { SignatureWorkspace } from "../../modules/signatures/ui/SignatureWorkspace";
import {
  createEmptyTemplate,
  duplicateTemplateInput,
  type TemplateInput,
  toTemplateInput,
} from "../../modules/templates/model";
import { TemplateWorkspace } from "../../modules/templates/ui/TemplateWorkspace";
import {
  buildTrashItemKey,
  collectTrashItems,
  findTrashSignature,
  type TrashItem,
} from "../../modules/trash/model";
import { TrashWorkspace } from "../../modules/trash/ui/TrashWorkspace";
import { maildraftApi } from "../../shared/api/maildraft-api";
import { BACKUP_FILE_FILTER, createBackupDefaultFileName } from "../../shared/lib/backup";
import { copyPlainText } from "../../shared/lib/clipboard";
import {
  type DraftSortOption,
  type SignatureSortOption,
  sortDrafts,
  sortSignatures,
  sortTemplates,
  type TemplateSortOption,
} from "../../shared/lib/list-sort";
import { matchesSearchQuery } from "../../shared/lib/search";
import {
  applyTheme,
  type AppTheme,
  persistTheme,
  resolveInitialTheme,
} from "../../shared/lib/theme";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";

type DraftAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const EMPTY_SNAPSHOT: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  templates: [],
  signatures: [],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};
const DEFAULT_LOGGING_SETTINGS = createDefaultLoggingSettingsSnapshot();
const AUTO_SAVE_DELAY_MS = 900;

interface ShortcutActionSet {
  changeView: (nextView: WorkspaceView) => void;
  createDraft: () => void;
  createTemplate: () => void;
  createSignature: () => void;
  saveDraft: () => Promise<void>;
  saveTemplate: () => Promise<void>;
  saveSignature: () => Promise<void>;
  saveLoggingSettings: () => Promise<void>;
  copyDraftPreview: () => Promise<void>;
  toggleDraftPinned: () => void;
  toggleTemplatePinned: () => void;
  toggleSignaturePinned: () => void;
}

export function useMaildraftApp() {
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
  const [draftAutoSaveState, setDraftAutoSaveState] = useState<DraftAutoSaveState>("idle");
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSortOption>("recent");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateSort, setTemplateSort] = useState<TemplateSortOption>("recent");
  const [signatureSearchQuery, setSignatureSearchQuery] = useState("");
  const [signatureSort, setSignatureSort] = useState<SignatureSortOption>("recent");

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [selectedTrashItemKey, setSelectedTrashItemKey] = useState<string | null>(null);

  const [draftForm, setDraftForm] = useState<DraftInput>(() => createEmptyDraft(null));
  const [templateForm, setTemplateForm] = useState<TemplateInput>(() => createEmptyTemplate(null));
  const [signatureForm, setSignatureForm] = useState<SignatureInput>(() =>
    createEmptySignature(true),
  );
  const [loggingForm, setLoggingForm] = useState<LoggingSettingsInput>(() =>
    toLoggingSettingsInput(DEFAULT_LOGGING_SETTINGS),
  );

  const draftFormRef = useRef(draftForm);
  const selectedDraftIdRef = useRef(selectedDraftId);
  const snapshotRef = useRef(snapshot);
  const viewRef = useRef(view);
  const isLoadingRef = useRef(isLoading);
  const shortcutActionsRef = useRef<ShortcutActionSet | null>(null);

  useEffect(() => {
    draftFormRef.current = draftForm;
  }, [draftForm]);

  useEffect(() => {
    selectedDraftIdRef.current = selectedDraftId;
  }, [selectedDraftId]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

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
        setDraftAutoSaveState("idle");
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

  const selectedDraftSignature = findTrashSignature(
    snapshot.signatures,
    snapshot.trash.signatures,
    draftForm.signatureId,
  );
  const selectedTemplateSignature = findTrashSignature(
    snapshot.signatures,
    snapshot.trash.signatures,
    templateForm.signatureId,
  );
  const persistedDraft = snapshot.drafts.find((draft) => draft.id === draftForm.id) ?? null;
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;
  const draftShouldPersist = selectedDraftId !== null || draftHasMeaningfulContent(draftForm);
  const draftIsDirty = draftShouldPersist && !draftInputsEqual(draftForm, persistedDraftInput);
  const draftChecks = collectDraftChecks(draftForm, selectedDraftSignature);
  const draftPreviewText = renderDraftPreview(draftForm, selectedDraftSignature);
  const draftPreviewSubject = renderDraftSubject(draftForm);
  const draftVariableNames = collectDraftVariableNames(draftForm, selectedDraftSignature);
  const draftHistory = snapshot.draftHistory.filter((entry) => entry.draftId === draftForm.id);
  const templatePreviewText = renderTemplatePreview(templateForm, selectedTemplateSignature);
  const trashItems = collectTrashItems(snapshot.trash);
  const filteredDrafts = sortDrafts(
    snapshot.drafts.filter((draft) =>
      matchesSearchQuery(draftSearchQuery, [
        draft.title,
        draft.subject,
        draft.recipient,
        draft.opening,
        draft.body,
        draft.closing,
        ...Object.values(draft.variableValues),
      ]),
    ),
    draftSort,
  );
  const filteredTemplates = sortTemplates(
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
  );
  const filteredSignatures = sortSignatures(
    snapshot.signatures.filter((signature) =>
      matchesSearchQuery(signatureSearchQuery, [signature.name, signature.body]),
    ),
    signatureSort,
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!draftShouldPersist) {
      setDraftAutoSaveState("idle");
      return;
    }

    if (!draftIsDirty) {
      setDraftAutoSaveState((current) => (current === "error" ? current : "saved"));
      return;
    }

    setDraftAutoSaveState("dirty");

    const timeout = window.setTimeout(() => {
      void persistDraft({
        input: draftForm,
        mode: "auto",
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [draftForm, draftIsDirty, draftShouldPersist, isLoading]);

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

    const firstDraft = nextSnapshot.drafts[0];
    const firstTemplate = nextSnapshot.templates[0];
    const firstSignature = nextSnapshot.signatures[0];

    setSelectedDraftId(firstDraft?.id ?? null);
    setSelectedTemplateId(firstTemplate?.id ?? null);
    setSelectedSignatureId(firstSignature?.id ?? null);
    setSelectedTrashItemKey(collectTrashItems(nextSnapshot.trash)[0]?.key ?? null);

    setDraftForm(
      firstDraft ? toDraftInput(firstDraft) : createEmptyDraft(getDefaultSignatureId(nextSnapshot)),
    );
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

  async function persistDraft({ input, mode }: { input: DraftInput; mode: "manual" | "auto" }) {
    const affectsCurrentDraft = draftFormRef.current.id === input.id;

    if (mode === "auto" && !shouldAutoPersistDraft(input, snapshotRef.current)) {
      return;
    }

    try {
      if (mode === "auto" && affectsCurrentDraft) {
        setDraftAutoSaveState("saving");
      }

      if (mode === "manual") {
        setError(null);
      }

      const nextSnapshot = await maildraftApi.saveDraft(input);
      setSnapshot(nextSnapshot);

      if (draftFormRef.current.id === input.id) {
        setSelectedDraftId(input.id);
        setDraftForm(pickDraftInput(nextSnapshot, input.id));
      }

      if (mode === "manual") {
        setDraftAutoSaveState("saved");
        setNotice("下書きを保存しました。");
      } else if (affectsCurrentDraft) {
        setDraftAutoSaveState("saved");
      }
    } catch (saveError) {
      if (affectsCurrentDraft) {
        setDraftAutoSaveState("error");
      }
      setError(asMessage(saveError));
    }
  }

  function flushPendingDraft() {
    if (!shouldAutoPersistDraft(draftFormRef.current, snapshotRef.current)) {
      return;
    }

    void persistDraft({
      input: draftFormRef.current,
      mode: "auto",
    });
  }

  function changeView(nextView: WorkspaceView) {
    if (viewRef.current === "drafts" && nextView !== "drafts") {
      flushPendingDraft();
    }

    setViewState(nextView);
  }

  function selectDraft(id: string) {
    if (selectedDraftIdRef.current !== id) {
      flushPendingDraft();
    }

    const draft = snapshot.drafts.find((item) => item.id === id);
    if (!draft) {
      return;
    }

    setSelectedDraftId(id);
    setDraftForm(toDraftInput(draft));
    setDraftAutoSaveState("saved");
    setViewState("drafts");
  }

  function createDraft() {
    flushPendingDraft();
    setSelectedDraftId(null);
    setDraftForm(createEmptyDraft(getDefaultSignatureId(snapshot)));
    setDraftAutoSaveState("idle");
    setViewState("drafts");
    setNotice("新しい下書きを作成しています。");
  }

  function changeDraft<K extends keyof DraftInput>(field: K, value: DraftInput[K]) {
    setDraftForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleDraftPinned() {
    setDraftForm((current) => ({
      ...current,
      isPinned: !current.isPinned,
    }));
  }

  function changeDraftVariable(name: string, value: string) {
    setDraftForm((current) => ({
      ...current,
      variableValues: {
        ...current.variableValues,
        [name]: value,
      },
    }));
  }

  function changeDraftSearchQuery(value: string) {
    setDraftSearchQuery(value);
  }

  function changeDraftSort(value: DraftSortOption) {
    setDraftSort(value);
  }

  async function saveDraft() {
    await persistDraft({
      input: draftForm,
      mode: "manual",
    });
  }

  async function duplicateDraft() {
    if (!selectedDraftId) {
      return;
    }

    const duplicate = duplicateDraftInput(draftForm);

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.saveDraft(duplicate);
      setSnapshot(nextSnapshot);
      setSelectedDraftId(duplicate.id);
      setDraftForm(pickDraftInput(nextSnapshot, duplicate.id));
      setDraftAutoSaveState("saved");
      setNotice("下書きを複製しました。");
    } catch (duplicateError) {
      setError(asMessage(duplicateError));
    }
  }

  async function deleteDraft() {
    if (!selectedDraftId) {
      createDraft();
      return;
    }

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.deleteDraft(selectedDraftId);
      setSnapshot(nextSnapshot);
      const nextSelectedId = nextSnapshot.drafts[0]?.id ?? null;
      setSelectedDraftId(nextSelectedId);
      setDraftForm(pickDraftInput(nextSnapshot, nextSelectedId));
      setDraftAutoSaveState(nextSelectedId ? "saved" : "idle");
      setSelectedTrashItemKey(buildTrashItemKey("draft", selectedDraftId));
      setNotice("下書きをゴミ箱に移動しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
    }
  }

  async function restoreDraftHistory(historyId: string) {
    const draftId = selectedDraftId ?? draftForm.id;

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.restoreDraftHistory(draftId, historyId);
      setSnapshot(nextSnapshot);
      setSelectedDraftId(draftId);
      setDraftForm(pickDraftInput(nextSnapshot, draftId));
      setDraftAutoSaveState("saved");
      setNotice("履歴から下書きを復元しました。");
    } catch (restoreError) {
      setError(asMessage(restoreError));
    }
  }

  async function copyDraftPreview() {
    try {
      setError(null);
      await copyPlainText(draftPreviewText);
      setNotice("プレーンテキストの本文をコピーしました。");
    } catch (copyError) {
      setError(asMessage(copyError));
    }
  }

  function applyTemplate(templateId: string) {
    const template = snapshot.templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setDraftForm((current) => applyTemplateToDraft(current, template));
    setNotice(`テンプレート「${template.name}」を下書きに反映しました。`);
  }

  function selectTemplate(id: string) {
    flushPendingDraft();

    const template = snapshot.templates.find((item) => item.id === id);
    if (!template) {
      return;
    }

    setSelectedTemplateId(id);
    setTemplateForm(toTemplateInput(template));
    setViewState("templates");
  }

  function createTemplate() {
    flushPendingDraft();
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
      setDraftForm((current) => ({
        ...current,
        templateId: templateExists(nextSnapshot, current.templateId) ? current.templateId : null,
      }));
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

    setViewState("drafts");
    setSelectedDraftId(null);
    setDraftAutoSaveState("idle");

    if (!template) {
      setDraftForm({
        ...createDraftFromTemplate(
          {
            ...templateForm,
            createdAt: "0",
            updatedAt: "0",
          },
          getDefaultSignatureId(snapshot),
        ),
        id: crypto.randomUUID(),
      });
      setNotice("未保存のテンプレートから新しい下書きを起こしました。");
      return;
    }

    setDraftForm(createDraftFromTemplate(template, getDefaultSignatureId(snapshot)));
    setNotice(`テンプレート「${template.name}」から新しい下書きを起こしました。`);
  }

  function selectSignature(id: string) {
    flushPendingDraft();

    const signature = snapshot.signatures.find((item) => item.id === id);
    if (!signature) {
      return;
    }

    setSelectedSignatureId(id);
    setSignatureForm(toSignatureInput(signature));
    setViewState("signatures");
  }

  function createSignature() {
    flushPendingDraft();
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
      setDraftForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
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
      setDraftForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
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
      setDraftForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
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
        setSelectedDraftId(item.draft.id);
        setDraftForm(pickDraftInput(nextSnapshot, item.draft.id));
        setDraftAutoSaveState("saved");
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
      setDraftForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
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
      okLabel: "Delete forever",
      cancelLabel: "Cancel",
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
        setDraftForm((current) => ({
          ...current,
          templateId: templateExists(nextSnapshot, current.templateId) ? current.templateId : null,
        }));
        setNotice("テンプレートを完全に削除しました。");
        return;
      }

      const nextSnapshot = await maildraftApi.permanentlyDeleteSignatureFromTrash(
        item.signature.id,
      );
      setSnapshot(nextSnapshot);
      setDraftForm((current) => ({
        ...current,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
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
      okLabel: "Empty trash",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      const nextSnapshot = await maildraftApi.emptyTrash();
      setSnapshot(nextSnapshot);
      setSelectedTrashItemKey(null);
      setDraftForm((current) => ({
        ...current,
        templateId: templateExists(nextSnapshot, current.templateId) ? current.templateId : null,
        signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
      }));
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
          okLabel: "Import",
          cancelLabel: "Cancel",
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
      hydrateLoggingSettings(imported.loggingSettings);
      setDraftAutoSaveState("idle");
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
      nextTheme === "dark" ? "ダークモードに切り替えました。" : "ライトモードに切り替えました。",
    );
  }

  function toggleWhitespace() {
    setShowWhitespace((current) => !current);
  }

  useEffect(() => {
    shortcutActionsRef.current = {
      changeView,
      createDraft,
      createTemplate,
      createSignature,
      saveDraft,
      saveTemplate,
      saveSignature,
      saveLoggingSettings,
      copyDraftPreview,
      toggleDraftPinned,
      toggleTemplatePinned,
      toggleSignaturePinned,
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
    views: [
      { id: "drafts" as const, label: "下書き", count: snapshot.drafts.length },
      { id: "templates" as const, label: "テンプレート", count: snapshot.templates.length },
      { id: "signatures" as const, label: "署名", count: snapshot.signatures.length },
      { id: "trash" as const, label: "ゴミ箱", count: trashItems.length },
      { id: "settings" as const, label: "設定" },
      { id: "help" as const, label: "ヘルプ" },
    ],
    snapshot,
    isLoading,
    error,
    notice,
    theme,
    view,
    setView: changeView,
    showWhitespace,
    toggleTheme,
    toggleWhitespace,
    draftWorkspace: (
      <DraftWorkspace
        autoSaveLabel={formatDraftAutoSaveState(draftAutoSaveState)}
        canDuplicate={selectedDraftId !== null}
        checks={draftChecks}
        draftForm={draftForm}
        draftHistory={draftHistory}
        drafts={filteredDrafts}
        searchQuery={draftSearchQuery}
        sort={draftSort}
        totalDraftCount={snapshot.drafts.length}
        previewSubject={draftPreviewSubject}
        previewText={draftPreviewText}
        selectedDraftId={selectedDraftId}
        signatures={snapshot.signatures}
        showWhitespace={showWhitespace}
        templates={snapshot.templates}
        variableNames={draftVariableNames}
        onApplyTemplate={applyTemplate}
        onChangeDraft={changeDraft}
        onChangeSearchQuery={changeDraftSearchQuery}
        onChangeSort={changeDraftSort}
        onChangeDraftVariable={changeDraftVariable}
        onCopyPreview={copyDraftPreview}
        onCreateDraft={createDraft}
        onDeleteDraft={deleteDraft}
        onDuplicateDraft={duplicateDraft}
        onRestoreDraftHistory={restoreDraftHistory}
        onSaveDraft={saveDraft}
        onSelectDraft={selectDraft}
        onTogglePinned={toggleDraftPinned}
      />
    ),
    templateWorkspace: (
      <TemplateWorkspace
        canDuplicate={selectedTemplateId !== null}
        searchQuery={templateSearchQuery}
        sort={templateSort}
        totalTemplateCount={snapshot.templates.length}
        onChangeTemplate={changeTemplate}
        onChangeSearchQuery={changeTemplateSearchQuery}
        onChangeSort={changeTemplateSort}
        onCreateTemplate={createTemplate}
        onDeleteTemplate={deleteTemplate}
        onDuplicateTemplate={duplicateTemplate}
        onSaveTemplate={saveTemplate}
        onSelectTemplate={selectTemplate}
        onStartDraftFromTemplate={startDraftFromTemplate}
        onTogglePinned={toggleTemplatePinned}
        previewText={templatePreviewText}
        selectedTemplateId={selectedTemplateId}
        signatures={snapshot.signatures}
        showWhitespace={showWhitespace}
        templateForm={templateForm}
        templates={filteredTemplates}
      />
    ),
    signatureWorkspace: (
      <SignatureWorkspace
        canDuplicate={selectedSignatureId !== null}
        searchQuery={signatureSearchQuery}
        sort={signatureSort}
        totalSignatureCount={snapshot.signatures.length}
        onChangeSignature={changeSignature}
        onChangeSearchQuery={changeSignatureSearchQuery}
        onChangeSort={changeSignatureSort}
        onCreateSignature={createSignature}
        onDeleteSignature={deleteSignature}
        onDuplicateSignature={duplicateSignature}
        onSaveSignature={saveSignature}
        onSelectSignature={selectSignature}
        onTogglePinned={toggleSignaturePinned}
        selectedSignatureId={selectedSignatureId}
        showWhitespace={showWhitespace}
        signatureForm={signatureForm}
        signatures={filteredSignatures}
      />
    ),
    trashWorkspace: (
      <TrashWorkspace
        items={trashItems}
        selectedItemKey={selectedTrashItemKey}
        showWhitespace={showWhitespace}
        signatures={snapshot.signatures}
        trashedSignatures={snapshot.trash.signatures}
        onDeleteItemPermanently={permanentlyDeleteTrashItem}
        onEmptyTrash={emptyTrash}
        onRestoreItem={restoreTrashItem}
        onSelectItem={selectTrashItem}
      />
    ),
    settingsWorkspace: (
      <SettingsWorkspace
        isExportingBackup={isExportingBackup}
        isImportingBackup={isImportingBackup}
        loggingForm={loggingForm}
        loggingSettings={loggingSettings}
        recentLogs={recentLogs}
        isLoadingRecentLogs={isLoadingRecentLogs}
        onChangeLogging={changeLogging}
        onClearLogs={clearLogs}
        onExportBackup={exportBackup}
        onImportBackup={importBackup}
        onRefreshRecentLogs={refreshRecentLogs}
        onSaveLoggingSettings={saveLoggingSettings}
      />
    ),
    helpWorkspace: <HelpWorkspace />,
  };
}

function shouldAutoPersistDraft(input: DraftInput, snapshot: StoreSnapshot): boolean {
  const persistedDraft = snapshot.drafts.find((draft) => draft.id === input.id);
  const persistedDraftInput = persistedDraft ? toDraftInput(persistedDraft) : null;

  if (!persistedDraft && !draftHasMeaningfulContent(input)) {
    return false;
  }

  return !draftInputsEqual(input, persistedDraftInput);
}

function formatDraftAutoSaveState(state: DraftAutoSaveState): string {
  switch (state) {
    case "idle":
      return "自動保存待機中";
    case "dirty":
      return "未保存の変更があります";
    case "saving":
      return "自動保存しています";
    case "saved":
      return "自動保存済み";
    case "error":
      return "自動保存に失敗しました";
  }
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

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

function getDefaultSignatureId(snapshot: StoreSnapshot): string | null {
  return (
    snapshot.signatures.find((signature) => signature.isDefault)?.id ??
    snapshot.signatures[0]?.id ??
    null
  );
}

function pickKnownSignatureId(snapshot: StoreSnapshot, signatureId: string | null): string | null {
  if (
    signatureId &&
    (snapshot.signatures.some((signature) => signature.id === signatureId) ||
      snapshot.trash.signatures.some((entry) => entry.signature.id === signatureId))
  ) {
    return signatureId;
  }

  return getDefaultSignatureId(snapshot);
}

function pickDraftInput(snapshot: StoreSnapshot, draftId: string | null): DraftInput {
  const existing = snapshot.drafts.find((draft) => draft.id === draftId) ?? snapshot.drafts[0];

  if (!existing) {
    return createEmptyDraft(getDefaultSignatureId(snapshot));
  }

  return toDraftInput(existing);
}

function pickTemplateInput(snapshot: StoreSnapshot, templateId: string | null): TemplateInput {
  const existing =
    snapshot.templates.find((template) => template.id === templateId) ?? snapshot.templates[0];

  if (!existing) {
    return createEmptyTemplate(getDefaultSignatureId(snapshot));
  }

  return toTemplateInput(existing);
}

function pickSignatureInput(snapshot: StoreSnapshot, signatureId: string | null): SignatureInput {
  const existing =
    snapshot.signatures.find((signature) => signature.id === signatureId) ?? snapshot.signatures[0];

  if (!existing) {
    return createEmptySignature(snapshot.signatures.length === 0);
  }

  return toSignatureInput(existing);
}

function templateExists(snapshot: StoreSnapshot, templateId: string | null): boolean {
  return Boolean(
    templateId &&
    (snapshot.templates.some((template) => template.id === templateId) ||
      snapshot.trash.templates.some((entry) => entry.template.id === templateId)),
  );
}

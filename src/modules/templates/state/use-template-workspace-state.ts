import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { sortTemplates, type TemplateSortOption } from "../../../shared/lib/list-sort";
import {
  buildSearchHaystack,
  createSearchTokens,
  matchesSearchTokens,
} from "../../../shared/lib/search";
import {
  applyDeletedTemplateResult,
  applySavedTemplateResult,
  getDefaultSignatureId,
  pickKnownSignatureId,
} from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot, WorkspaceView } from "../../../shared/types/store";
import {
  createDraftFromTemplate,
  createDraftFromTemplateInput,
  type DraftInput,
} from "../../drafts/model";
import { renderTemplatePreview } from "../../renderer/render-draft";
import { buildTrashItemKey, findTrashSignature } from "../../trash/model";
import {
  createEmptyTemplate,
  duplicateTemplateInput,
  type Template,
  type TemplateInput,
  toTemplateInput,
} from "../model";

export interface TemplateWorkspaceStateOptions {
  onClearError: () => void;
  onError: (message: string) => void;
  onFlushDraft: () => void;
  onNotice: (message: string) => void;
  onOpenDraftInput: (input: DraftInput) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  onTrashItemSelect: (key: string | null) => void;
  onViewChange: (view: WorkspaceView) => void;
  snapshot: StoreSnapshot;
}

interface TemplateSelectionState {
  selectedTemplateId: string | null;
  templateForm: TemplateInput;
}

function findTemplate(snapshot: StoreSnapshot, templateId: string | null): Template | null {
  if (!templateId) {
    return null;
  }

  return snapshot.templates.find((template) => template.id === templateId) ?? null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

/**
 * Resolves the template that should back the editing form for the current snapshot.
 *
 * @remarks
 * The preferred template is used only while it remains active. When it disappears, the state
 * falls back to the first active template or to a new empty form.
 */
export function buildTemplateEditingState(
  snapshot: StoreSnapshot,
  preferredTemplateId: string | null = null,
): TemplateSelectionState {
  const selectedTemplate =
    findTemplate(snapshot, preferredTemplateId) ?? snapshot.templates[0] ?? null;

  return {
    selectedTemplateId: selectedTemplate?.id ?? null,
    templateForm: selectedTemplate
      ? toTemplateInput(selectedTemplate)
      : createEmptyTemplate(getDefaultSignatureId(snapshot)),
  };
}

/**
 * Coordinates template selection, editing, and persistence against the current store snapshot.
 *
 * @remarks
 * Selection always falls back to an existing active template, or to a new empty form when no
 * active template remains. Save and delete operations patch compact backend payloads into the
 * current snapshot instead of replacing the full store.
 */
export function useTemplateWorkspaceState({
  onClearError,
  onError,
  onFlushDraft,
  onNotice,
  onOpenDraftInput,
  onSnapshotChange,
  onTrashItemSelect,
  onViewChange,
  snapshot,
}: TemplateWorkspaceStateOptions) {
  const [initialTemplateState] = useState(() => buildTemplateEditingState(snapshot));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateState.selectedTemplateId,
  );
  const [templateForm, setTemplateForm] = useState<TemplateInput>(initialTemplateState.templateForm);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateSort, setTemplateSort] = useState<TemplateSortOption>("recent");
  const deferredTemplateSearchQuery = useDeferredValue(templateSearchQuery);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const selectedTemplateSignature = useMemo(
    () =>
      findTrashSignature(
        snapshot.signatures,
        snapshot.trash.signatures,
        templateForm.signatureId,
      ),
    [snapshot.signatures, snapshot.trash.signatures, templateForm.signatureId],
  );
  const templatePreviewText = useMemo(
    () => renderTemplatePreview(templateForm, selectedTemplateSignature),
    [selectedTemplateSignature, templateForm],
  );
  const templateSearchTokens = useMemo(
    () => createSearchTokens(deferredTemplateSearchQuery),
    [deferredTemplateSearchQuery],
  );
  const templateSearchIndex = useMemo(
    () =>
      snapshot.templates.map((template) => ({
        haystack: buildSearchHaystack([
          template.name,
          template.subject,
          template.recipient,
          template.opening,
          template.body,
          template.closing,
        ]),
        template,
      })),
    [snapshot.templates],
  );
  const filteredTemplates = useMemo(
    () =>
      sortTemplates(
        templateSearchTokens.length === 0
          ? snapshot.templates
          : templateSearchIndex
              .filter(({ haystack }) => matchesSearchTokens(templateSearchTokens, haystack))
              .map(({ template }) => template),
        templateSort,
      ),
    [snapshot.templates, templateSearchIndex, templateSearchTokens, templateSort],
  );

  function hydrateTemplateState(
    nextSnapshot: StoreSnapshot,
    preferredTemplateId: string | null = null,
  ) {
    const nextState = buildTemplateEditingState(nextSnapshot, preferredTemplateId);
    setSelectedTemplateId(nextState.selectedTemplateId);
    setTemplateForm(nextState.templateForm);
  }

  function syncTemplateSignatureId(nextSnapshot: StoreSnapshot) {
    setTemplateForm((current) => ({
      ...current,
      signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
    }));
  }

  const selectTemplate = useCallback((templateId: string) => {
    onFlushDraft();

    const template = findTemplate(snapshot, templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(templateId);
    setTemplateForm(toTemplateInput(template));
    onViewChange("templates");
  }, [onFlushDraft, onViewChange, snapshot]);

  const createTemplate = useCallback(() => {
    onFlushDraft();
    setSelectedTemplateId(null);
    setTemplateForm(createEmptyTemplate(getDefaultSignatureId(snapshot)));
    onViewChange("templates");
    onNotice("新しいテンプレートを作成しています。");
  }, [onFlushDraft, onNotice, onViewChange, snapshot]);

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

  async function saveTemplate() {
    try {
      onClearError();
      const savedTemplate = await maildraftApi.saveTemplate(templateForm);
      const nextSnapshot = applySavedTemplateResult(snapshotRef.current, savedTemplate);
      onSnapshotChange(nextSnapshot);
      hydrateTemplateState(nextSnapshot, savedTemplate.template.id);
      onNotice("テンプレートを保存しました。");
    } catch (saveError) {
      onError(toErrorMessage(saveError));
    }
  }

  async function duplicateTemplate() {
    if (!selectedTemplateId) {
      return;
    }

    const duplicate = duplicateTemplateInput(templateForm);

    try {
      onClearError();
      const savedTemplate = await maildraftApi.saveTemplate(duplicate);
      const nextSnapshot = applySavedTemplateResult(snapshotRef.current, savedTemplate);
      onSnapshotChange(nextSnapshot);
      hydrateTemplateState(nextSnapshot, savedTemplate.template.id);
      onNotice("テンプレートを複製しました。");
    } catch (duplicateError) {
      onError(toErrorMessage(duplicateError));
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) {
      createTemplate();
      return;
    }

    try {
      onClearError();
      const deletedTemplate = await maildraftApi.deleteTemplate(selectedTemplateId);
      const nextSnapshot = applyDeletedTemplateResult(snapshotRef.current, deletedTemplate);
      onSnapshotChange(nextSnapshot);
      hydrateTemplateState(nextSnapshot);
      onTrashItemSelect(buildTrashItemKey("template", selectedTemplateId));
      onNotice("テンプレートをゴミ箱に移動しました。");
    } catch (deleteError) {
      onError(toErrorMessage(deleteError));
    }
  }

  function startDraftFromTemplate() {
    const template = findTemplate(snapshot, templateForm.id);
    const fallbackSignatureId = getDefaultSignatureId(snapshot);
    const nextDraft = template
      ? createDraftFromTemplate(template, fallbackSignatureId)
      : createDraftFromTemplateInput(templateForm, fallbackSignatureId);

    onOpenDraftInput(nextDraft);
    onViewChange("drafts");
    onNotice(
      template
        ? `テンプレート「${template.name}」から新しい下書きを起こしました。`
        : "未保存のテンプレートから新しい下書きを起こしました。",
    );
  }

  return {
    createTemplate,
    hydrateTemplateState,
    saveTemplate,
    syncTemplateSignatureId,
    toggleTemplatePinned,
    templateWorkspaceProps: {
      canDuplicate: selectedTemplateId !== null,
      onChangeSearchQuery: setTemplateSearchQuery,
      onChangeSort: setTemplateSort,
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
      showWhitespace: false,
      signatures: snapshot.signatures,
      sort: templateSort,
      templateForm,
      templates: filteredTemplates,
      totalTemplateCount: snapshot.templates.length,
    },
  };
}

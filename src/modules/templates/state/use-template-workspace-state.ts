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
import { collectUniqueTags, matchesTagFilter } from "../../../shared/lib/tags";
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
import {
  createInitialTemplateState,
  formatTemplateAutoSaveState,
  toTemplateWorkspaceErrorMessage,
} from "./template-workspace-helpers";
import { useTemplateAutoSave } from "./use-template-auto-save";

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
  const [initialTemplateState] = useState(() => createInitialTemplateState(snapshot));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateState.selectedTemplateId,
  );
  const [templateForm, setTemplateForm] = useState<TemplateInput>(
    initialTemplateState.templateForm,
  );
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateSort, setTemplateSort] = useState<TemplateSortOption>("recent");
  const [templateTagFilterState, setTemplateTagFilter] = useState<string | null>(null);
  const deferredTemplateSearchQuery = useDeferredValue(templateSearchQuery);
  const templateFormRef = useRef(templateForm);
  const selectedTemplateIdRef = useRef(selectedTemplateId);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    templateFormRef.current = templateForm;
  }, [templateForm]);

  useEffect(() => {
    selectedTemplateIdRef.current = selectedTemplateId;
  }, [selectedTemplateId]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const selectedTemplateSignature = useMemo(
    () =>
      findTrashSignature(snapshot.signatures, snapshot.trash.signatures, templateForm.signatureId),
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
          ...template.tags,
        ]),
        template,
      })),
    [snapshot.templates],
  );
  const availableTemplateTags = useMemo(
    () => collectUniqueTags(snapshot.templates),
    [snapshot.templates],
  );
  const activeTemplateTagFilter = availableTemplateTagsIncludes(
    availableTemplateTags,
    templateTagFilterState,
  )
    ? templateTagFilterState
    : null;
  const filteredTemplates = useMemo(
    () =>
      sortTemplates(
        templateSearchIndex
          .filter(({ haystack, template }) => {
            const matchesSearch =
              templateSearchTokens.length === 0 ||
              matchesSearchTokens(templateSearchTokens, haystack);

            return matchesSearch && matchesTagFilter(template.tags, activeTemplateTagFilter);
          })
          .map(({ template }) => template),
        templateSort,
      ),
    [activeTemplateTagFilter, templateSearchIndex, templateSearchTokens, templateSort],
  );

  const { flushPendingTemplate, saveTemplate, setTemplateAutoSaveState, templateAutoSaveState } =
    useTemplateAutoSave({
      initialAutoSaveState: initialTemplateState.autoSaveState,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      selectedTemplateId,
      setSelectedTemplateId,
      setTemplateForm,
      snapshot,
      snapshotRef,
      templateForm,
      templateFormRef,
    });

  function hydrateTemplateState(
    nextSnapshot: StoreSnapshot,
    preferredTemplateId: string | null = null,
  ) {
    const nextState = buildTemplateEditingState(nextSnapshot, preferredTemplateId);
    setSelectedTemplateId(nextState.selectedTemplateId);
    setTemplateForm(nextState.templateForm);
    setTemplateAutoSaveState(nextState.selectedTemplateId ? "saved" : "idle");
  }

  function syncTemplateSignatureId(nextSnapshot: StoreSnapshot) {
    setTemplateForm((current) => ({
      ...current,
      signatureId: pickKnownSignatureId(nextSnapshot, current.signatureId),
    }));
  }

  const selectTemplate = useCallback(
    (templateId: string) => {
      onFlushDraft();
      if (selectedTemplateIdRef.current !== templateId) {
        flushPendingTemplate();
      }

      const template = findTemplate(snapshot, templateId);
      if (!template) {
        return;
      }

      setSelectedTemplateId(templateId);
      setTemplateForm(toTemplateInput(template));
      setTemplateAutoSaveState("saved");
      onViewChange("templates");
    },
    [flushPendingTemplate, onFlushDraft, onViewChange, setTemplateAutoSaveState, snapshot],
  );

  const createTemplate = useCallback(() => {
    onFlushDraft();
    flushPendingTemplate();
    setSelectedTemplateId(null);
    setTemplateForm(createEmptyTemplate(getDefaultSignatureId(snapshot)));
    setTemplateAutoSaveState("idle");
    onViewChange("templates");
    onNotice("新しいテンプレートを作成しています。");
  }, [
    flushPendingTemplate,
    onFlushDraft,
    onNotice,
    onViewChange,
    setTemplateAutoSaveState,
    snapshot,
  ]);

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
      onError(toTemplateWorkspaceErrorMessage(duplicateError));
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
      onError(toTemplateWorkspaceErrorMessage(deleteError));
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
    flushPendingTemplate,
    hydrateTemplateState,
    saveTemplate,
    syncTemplateSignatureId,
    toggleTemplatePinned,
    templateWorkspaceProps: {
      activeTagFilter: activeTemplateTagFilter,
      autoSaveLabel: formatTemplateAutoSaveState(templateAutoSaveState),
      availableTags: availableTemplateTags,
      canDuplicate: selectedTemplateId !== null,
      onChangeSearchQuery: setTemplateSearchQuery,
      onChangeSort: setTemplateSort,
      onChangeTagFilter: setTemplateTagFilter,
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

function availableTemplateTagsIncludes(tags: string[], value: string | null): value is string {
  return value !== null && tags.includes(value);
}

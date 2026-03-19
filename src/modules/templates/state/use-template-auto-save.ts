import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { applySavedTemplateResult } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import { type TemplateInput, templateMatchesPersistedTemplate, toTemplateInput } from "../model";
import {
  hasMeaningfulTemplateContent,
  shouldAutoPersistTemplate,
  type TemplateAutoSaveState,
  toTemplateWorkspaceErrorMessage,
} from "./template-workspace-helpers";

const AUTO_SAVE_DELAY_MS = 900;

interface TemplateAutoSaveOptions {
  initialAutoSaveState: TemplateAutoSaveState;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  selectedTemplateId: string | null;
  setSelectedTemplateId: Dispatch<SetStateAction<string | null>>;
  setTemplateForm: Dispatch<SetStateAction<TemplateInput>>;
  snapshot: StoreSnapshot;
  snapshotRef: RefObject<StoreSnapshot>;
  templateForm: TemplateInput;
  templateFormRef: RefObject<TemplateInput>;
}

interface TransientTemplateAutoSaveState {
  kind: "error" | "saving";
  templateRevision: string;
}

export function useTemplateAutoSave({
  initialAutoSaveState,
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
}: TemplateAutoSaveOptions) {
  const [transientTemplateAutoSaveState, setTransientTemplateAutoSaveState] =
    useState<TransientTemplateAutoSaveState | null>(() =>
      initialAutoSaveState === "error" || initialAutoSaveState === "saving"
        ? {
            kind: initialAutoSaveState,
            templateRevision: serializeTemplateRevision(templateForm),
          }
        : null,
    );

  const persistTemplate = useCallback(
    async ({ input, mode }: { input: TemplateInput; mode: "manual" | "auto" }) => {
      const affectsCurrentTemplate = templateFormRef.current.id === input.id;

      if (mode === "auto" && !shouldAutoPersistTemplate(input, snapshotRef.current)) {
        return;
      }

      try {
        if (mode === "auto" && affectsCurrentTemplate) {
          setTransientTemplateAutoSaveState({
            kind: "saving",
            templateRevision: serializeTemplateRevision(input),
          });
        }

        if (mode === "manual") {
          onClearError();
        }

        const savedTemplate = await maildraftApi.saveTemplate(input);
        const nextSnapshot = applySavedTemplateResult(snapshotRef.current, savedTemplate);
        onSnapshotChange(nextSnapshot);

        if (templateFormRef.current.id === savedTemplate.template.id) {
          setSelectedTemplateId(savedTemplate.template.id);
          setTemplateForm(toTemplateInput(savedTemplate.template));
        }

        if (mode === "manual") {
          setTransientTemplateAutoSaveState(null);
          onNotice("テンプレートを保存しました。");
        } else if (affectsCurrentTemplate) {
          setTransientTemplateAutoSaveState(null);
        }
      } catch (saveError) {
        if (affectsCurrentTemplate) {
          setTransientTemplateAutoSaveState({
            kind: "error",
            templateRevision: serializeTemplateRevision(input),
          });
        }

        onError(toTemplateWorkspaceErrorMessage(saveError));
      }
    },
    [
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      setSelectedTemplateId,
      setTemplateForm,
      snapshotRef,
      templateFormRef,
    ],
  );

  const persistedTemplateIndex = useMemo(
    () => new Map(snapshot.templates.map((template) => [template.id, template] as const)),
    [snapshot.templates],
  );
  const persistedTemplate = persistedTemplateIndex.get(templateForm.id) ?? null;
  const templateShouldPersist =
    selectedTemplateId !== null || hasMeaningfulTemplateContent(templateForm, snapshot);
  const templateIsDirty =
    templateShouldPersist && !templateMatchesPersistedTemplate(templateForm, persistedTemplate);
  const templateRevision = useMemo(() => serializeTemplateRevision(templateForm), [templateForm]);
  const baseTemplateAutoSaveState: TemplateAutoSaveState = !templateShouldPersist
    ? "idle"
    : templateIsDirty
      ? "dirty"
      : "saved";
  const templateAutoSaveState =
    transientTemplateAutoSaveState?.templateRevision === templateRevision
      ? transientTemplateAutoSaveState.kind
      : baseTemplateAutoSaveState;

  useEffect(() => {
    if (!templateShouldPersist || !templateIsDirty) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistTemplate({
        input: templateForm,
        mode: "auto",
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [persistTemplate, templateForm, templateIsDirty, templateShouldPersist]);

  const flushPendingTemplate = useCallback(() => {
    if (!shouldAutoPersistTemplate(templateFormRef.current, snapshotRef.current)) {
      return;
    }

    void persistTemplate({
      input: templateFormRef.current,
      mode: "auto",
    });
  }, [persistTemplate, snapshotRef, templateFormRef]);

  const setTemplateAutoSaveState = useCallback(
    (nextState: TemplateAutoSaveState) => {
      if (nextState === "error" || nextState === "saving") {
        setTransientTemplateAutoSaveState({
          kind: nextState,
          templateRevision: serializeTemplateRevision(templateFormRef.current),
        });
        return;
      }

      setTransientTemplateAutoSaveState(null);
    },
    [templateFormRef],
  );

  const saveTemplate = useCallback(async () => {
    await persistTemplate({
      input: templateForm,
      mode: "manual",
    });
  }, [persistTemplate, templateForm]);

  return {
    flushPendingTemplate,
    saveTemplate,
    setTemplateAutoSaveState,
    templateAutoSaveState,
  };
}

function serializeTemplateRevision(input: TemplateInput): string {
  return JSON.stringify({
    body: input.body,
    closing: input.closing,
    id: input.id,
    isPinned: input.isPinned,
    name: input.name,
    opening: input.opening,
    recipient: input.recipient,
    signatureId: input.signatureId,
    subject: input.subject,
  });
}

import { getDefaultSignatureId } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  createEmptyTemplate,
  type TemplateInput,
  templateInputsEqual,
  templateMatchesPersistedTemplate,
  toTemplateInput,
} from "../model";

export type TemplateAutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface InitialTemplateState {
  autoSaveState: TemplateAutoSaveState;
  selectedTemplateId: string | null;
  templateForm: TemplateInput;
}

export function createInitialTemplateState(snapshot: StoreSnapshot): InitialTemplateState {
  const firstTemplate = snapshot.templates[0];

  if (!firstTemplate) {
    return {
      autoSaveState: "idle",
      selectedTemplateId: null,
      templateForm: createEmptyTemplate(getDefaultSignatureId(snapshot)),
    };
  }

  return {
    autoSaveState: "saved",
    selectedTemplateId: firstTemplate.id,
    templateForm: toTemplateInput(firstTemplate),
  };
}

export function formatTemplateAutoSaveState(state: TemplateAutoSaveState): string {
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

export function hasMeaningfulTemplateContent(
  input: TemplateInput,
  snapshot: StoreSnapshot,
): boolean {
  const emptyTemplate = createEmptyTemplate(getDefaultSignatureId(snapshot));

  return !templateInputsEqual(input, {
    ...emptyTemplate,
    id: input.id,
  });
}

export function shouldAutoPersistTemplate(input: TemplateInput, snapshot: StoreSnapshot): boolean {
  const persistedTemplate = snapshot.templates.find((template) => template.id === input.id);

  if (!persistedTemplate && !hasMeaningfulTemplateContent(input, snapshot)) {
    return false;
  }

  return !templateMatchesPersistedTemplate(input, persistedTemplate ?? null);
}

export function toTemplateWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "処理に失敗しました。";
}

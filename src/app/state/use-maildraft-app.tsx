import { useEffect, useState } from "react";

import {
  applyTemplateToDraft,
  createDraftFromTemplate,
  createEmptyDraft,
  type DraftInput,
  toDraftInput,
} from "../../modules/drafts/model";
import { DraftWorkspace } from "../../modules/drafts/ui/DraftWorkspace";
import {
  collectDraftChecks,
  renderDraftPreview,
  renderTemplatePreview,
} from "../../modules/renderer/render-draft";
import {
  createEmptySignature,
  type SignatureInput,
  toSignatureInput,
} from "../../modules/signatures/model";
import { SignatureWorkspace } from "../../modules/signatures/ui/SignatureWorkspace";
import {
  createEmptyTemplate,
  type TemplateInput,
  toTemplateInput,
} from "../../modules/templates/model";
import { TemplateWorkspace } from "../../modules/templates/ui/TemplateWorkspace";
import { maildraftApi } from "../../shared/api/maildraft-api";
import { copyPlainText } from "../../shared/lib/clipboard";
import {
  applyTheme,
  type AppTheme,
  persistTheme,
  resolveInitialTheme,
} from "../../shared/lib/theme";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";

const EMPTY_SNAPSHOT: StoreSnapshot = {
  drafts: [],
  templates: [],
  signatures: [],
};

export function useMaildraftApp() {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("ローカル保存の準備をしています。");
  const [view, setView] = useState<WorkspaceView>("drafts");
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme());
  const [showWhitespace, setShowWhitespace] = useState(false);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);

  const [draftForm, setDraftForm] = useState<DraftInput>(() => createEmptyDraft(null));
  const [templateForm, setTemplateForm] = useState<TemplateInput>(() => createEmptyTemplate(null));
  const [signatureForm, setSignatureForm] = useState<SignatureInput>(() =>
    createEmptySignature(true),
  );

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const nextSnapshot = await maildraftApi.loadSnapshot();
        hydrateAll(nextSnapshot);
        setNotice("ローカルデータを読み込みました。");
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

  function hydrateAll(nextSnapshot: StoreSnapshot) {
    setSnapshot(nextSnapshot);

    const firstDraft = nextSnapshot.drafts[0];
    const firstTemplate = nextSnapshot.templates[0];
    const firstSignature = nextSnapshot.signatures[0];

    setSelectedDraftId(firstDraft?.id ?? null);
    setSelectedTemplateId(firstTemplate?.id ?? null);
    setSelectedSignatureId(firstSignature?.id ?? null);

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

  function selectDraft(id: string) {
    const draft = snapshot.drafts.find((item) => item.id === id);
    if (!draft) {
      return;
    }

    setSelectedDraftId(id);
    setDraftForm(toDraftInput(draft));
    setView("drafts");
  }

  function createDraft() {
    setSelectedDraftId(null);
    setDraftForm(createEmptyDraft(getDefaultSignatureId(snapshot)));
    setView("drafts");
    setNotice("新しい下書きを作成しています。");
  }

  function changeDraft<K extends keyof DraftInput>(field: K, value: DraftInput[K]) {
    setDraftForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveDraft() {
    try {
      setError(null);
      const nextSnapshot = await maildraftApi.saveDraft(draftForm);
      setSnapshot(nextSnapshot);
      setSelectedDraftId(draftForm.id);
      setDraftForm(pickDraftInput(nextSnapshot, draftForm.id));
      setNotice("下書きを保存しました。");
    } catch (saveError) {
      setError(asMessage(saveError));
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
      setNotice("下書きを削除しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
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
    const template = snapshot.templates.find((item) => item.id === id);
    if (!template) {
      return;
    }

    setSelectedTemplateId(id);
    setTemplateForm(toTemplateInput(template));
    setView("templates");
  }

  function createTemplate() {
    setSelectedTemplateId(null);
    setTemplateForm(createEmptyTemplate(getDefaultSignatureId(snapshot)));
    setView("templates");
    setNotice("新しいテンプレートを作成しています。");
  }

  function changeTemplate<K extends keyof TemplateInput>(field: K, value: TemplateInput[K]) {
    setTemplateForm((current) => ({
      ...current,
      [field]: value,
    }));
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
      setDraftForm((current) => ({
        ...current,
        templateId: templateExists(nextSnapshot, current.templateId) ? current.templateId : null,
      }));
      setNotice("テンプレートを削除しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
    }
  }

  function startDraftFromTemplate() {
    const template = snapshot.templates.find((item) => item.id === templateForm.id);

    if (!template) {
      setView("drafts");
      setSelectedDraftId(null);
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

    setView("drafts");
    setSelectedDraftId(null);
    setDraftForm(createDraftFromTemplate(template, getDefaultSignatureId(snapshot)));
    setNotice(`テンプレート「${template.name}」から新しい下書きを起こしました。`);
  }

  function selectSignature(id: string) {
    const signature = snapshot.signatures.find((item) => item.id === id);
    if (!signature) {
      return;
    }

    setSelectedSignatureId(id);
    setSignatureForm(toSignatureInput(signature));
    setView("signatures");
  }

  function createSignature() {
    setSelectedSignatureId(null);
    setSignatureForm(createEmptySignature(snapshot.signatures.length === 0));
    setView("signatures");
    setNotice("新しい署名を作成しています。");
  }

  function changeSignature<K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) {
    setSignatureForm((current) => ({
      ...current,
      [field]: value,
    }));
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
        signatureId: pickExistingSignatureId(nextSnapshot, current.signatureId),
      }));
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickExistingSignatureId(nextSnapshot, current.signatureId),
      }));
      setNotice("署名を保存しました。");
    } catch (saveError) {
      setError(asMessage(saveError));
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
        signatureId: pickExistingSignatureId(nextSnapshot, current.signatureId),
      }));
      setTemplateForm((current) => ({
        ...current,
        signatureId: pickExistingSignatureId(nextSnapshot, current.signatureId),
      }));
      setNotice("署名を削除しました。");
    } catch (deleteError) {
      setError(asMessage(deleteError));
    }
  }

  const selectedDraftSignature = snapshot.signatures.find(
    (signature) => signature.id === draftForm.signatureId,
  );
  const selectedTemplateSignature = snapshot.signatures.find(
    (signature) => signature.id === templateForm.signatureId,
  );

  const draftChecks = collectDraftChecks(draftForm, selectedDraftSignature);
  const draftPreviewText = renderDraftPreview(draftForm, selectedDraftSignature);
  const templatePreviewText = renderTemplatePreview(templateForm, selectedTemplateSignature);

  return {
    views: [
      { id: "drafts" as const, label: "下書き", count: snapshot.drafts.length },
      { id: "templates" as const, label: "テンプレート", count: snapshot.templates.length },
      { id: "signatures" as const, label: "署名", count: snapshot.signatures.length },
    ],
    snapshot,
    isLoading,
    error,
    notice,
    theme,
    view,
    setView,
    showWhitespace,
    toggleTheme() {
      const nextTheme = theme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
      setNotice(
        nextTheme === "dark" ? "ダークモードに切り替えました。" : "ライトモードに切り替えました。",
      );
    },
    toggleWhitespace() {
      setShowWhitespace((current) => !current);
    },
    draftWorkspace: (
      <DraftWorkspace
        checks={draftChecks}
        draftForm={draftForm}
        drafts={snapshot.drafts}
        previewText={draftPreviewText}
        selectedDraftId={selectedDraftId}
        signatures={snapshot.signatures}
        showWhitespace={showWhitespace}
        templates={snapshot.templates}
        onApplyTemplate={applyTemplate}
        onChangeDraft={changeDraft}
        onCopyPreview={copyDraftPreview}
        onCreateDraft={createDraft}
        onDeleteDraft={deleteDraft}
        onSaveDraft={saveDraft}
        onSelectDraft={selectDraft}
      />
    ),
    templateWorkspace: (
      <TemplateWorkspace
        onChangeTemplate={changeTemplate}
        onCreateTemplate={createTemplate}
        onDeleteTemplate={deleteTemplate}
        onSaveTemplate={saveTemplate}
        onSelectTemplate={selectTemplate}
        onStartDraftFromTemplate={startDraftFromTemplate}
        previewText={templatePreviewText}
        selectedTemplateId={selectedTemplateId}
        signatures={snapshot.signatures}
        showWhitespace={showWhitespace}
        templateForm={templateForm}
        templates={snapshot.templates}
      />
    ),
    signatureWorkspace: (
      <SignatureWorkspace
        onChangeSignature={changeSignature}
        onCreateSignature={createSignature}
        onDeleteSignature={deleteSignature}
        onSaveSignature={saveSignature}
        onSelectSignature={selectSignature}
        selectedSignatureId={selectedSignatureId}
        showWhitespace={showWhitespace}
        signatureForm={signatureForm}
        signatures={snapshot.signatures}
      />
    ),
  };
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

function pickExistingSignatureId(
  snapshot: StoreSnapshot,
  signatureId: string | null,
): string | null {
  if (signatureId && snapshot.signatures.some((signature) => signature.id === signatureId)) {
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
  return Boolean(templateId && snapshot.templates.some((template) => template.id === templateId));
}

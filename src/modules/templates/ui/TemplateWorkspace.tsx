import { useState } from "react";

import type { TemplateSortOption } from "../../../shared/lib/list-sort";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import type { EditorSettings } from "../../../shared/ui/code-editor/editor-settings";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template, TemplateInput } from "../model";
import { TemplateEditorPane } from "./panes/TemplateEditorPane";
import { TemplateListPane } from "./panes/TemplateListPane";
import { TemplatePreviewDialogContent } from "./panes/TemplatePreviewDialogContent";
import { TemplatePreviewPane } from "./panes/TemplatePreviewPane";

interface TemplateWorkspaceProps {
  templates: Template[];
  totalTemplateCount: number;
  signatures: Signature[];
  selectedTemplateId: string | null;
  templateForm: TemplateInput;
  autoSaveLabel: string;
  previewText: string;
  editorSettings?: EditorSettings;
  showWhitespace: boolean;
  searchQuery: string;
  sort: TemplateSortOption;
  canDuplicate: boolean;
  onSelectTemplate: (id: string) => void;
  onCreateTemplate: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: TemplateSortOption) => void;
  onChangeTemplate: <K extends keyof TemplateInput>(field: K, value: TemplateInput[K]) => void;
  onSaveTemplate: () => Promise<void>;
  onDeleteTemplate: () => Promise<void>;
  onDuplicateTemplate: () => Promise<void>;
  onStartDraftFromTemplate: () => void;
  onTogglePinned: () => void;
}

export function TemplateWorkspace({
  templates,
  totalTemplateCount,
  signatures,
  selectedTemplateId,
  templateForm,
  autoSaveLabel,
  previewText,
  editorSettings,
  showWhitespace,
  searchQuery,
  sort,
  canDuplicate,
  onSelectTemplate,
  onCreateTemplate,
  onChangeSearchQuery,
  onChangeSort,
  onChangeTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onStartDraftFromTemplate,
  onTogglePinned,
}: TemplateWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const canExpandPreview = previewText.trim().length > 0 || templateForm.subject.trim().length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
    "テンプレートのプレビューがここに表示されます。";

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_300px]">
        <TemplateListPane
          searchQuery={searchQuery}
          selectedTemplateId={selectedTemplateId}
          sort={sort}
          templates={templates}
          totalTemplateCount={totalTemplateCount}
          onChangeSearchQuery={onChangeSearchQuery}
          onChangeSort={onChangeSort}
          onCreateTemplate={onCreateTemplate}
          onSelectTemplate={onSelectTemplate}
        />

        <TemplateEditorPane
          autoSaveLabel={autoSaveLabel}
          canDuplicate={canDuplicate}
          editorSettings={editorSettings}
          selectedTemplateId={selectedTemplateId}
          showWhitespace={showWhitespace}
          signatures={signatures}
          templateForm={templateForm}
          onChangeTemplate={onChangeTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onDuplicateTemplate={onDuplicateTemplate}
          onSaveTemplate={onSaveTemplate}
          onTogglePinned={onTogglePinned}
        />

        <TemplatePreviewPane
          canExpandPreview={canExpandPreview}
          previewBodyText={previewBodyText}
          templateForm={templateForm}
          onOpenPreview={() => setIsWidePreviewOpen(true)}
          onStartDraftFromTemplate={onStartDraftFromTemplate}
        />
      </div>

      <PreviewOverlay
        action={
          <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
            下書きを作成
          </Button>
        }
        description="仕上がり表示"
        isOpen={isWidePreviewOpen}
        title="テンプレートプレビュー"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <TemplatePreviewDialogContent
          previewBodyText={previewBodyText}
          subject={templateForm.subject}
        />
      </PreviewOverlay>
    </>
  );
}

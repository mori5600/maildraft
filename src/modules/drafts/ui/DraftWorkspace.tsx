import { useState } from "react";

import type { DraftSortOption } from "../../../shared/lib/list-sort";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template } from "../../templates/model";
import type { Draft, DraftHistoryEntry, DraftInput } from "../model";
import type { VariablePreset } from "../variable-presets";
import { DraftHistoryOverlay } from "./DraftHistoryOverlay";
import { DraftEditorPane } from "./panes/DraftEditorPane";
import { DraftListPane } from "./panes/DraftListPane";
import { DraftPreviewDialogContent } from "./panes/DraftPreviewDialogContent";
import { DraftPreviewPane } from "./panes/DraftPreviewPane";

interface DraftWorkspaceProps {
  drafts: Draft[];
  totalDraftCount: number;
  draftHistory: DraftHistoryEntry[];
  templates: Template[];
  signatures: Signature[];
  selectedDraftId: string | null;
  draftForm: DraftInput;
  previewSubject: string;
  previewText: string;
  checks: string[];
  variableNames: string[];
  variablePresets: VariablePreset[];
  selectedVariablePresetId: string | null;
  variablePresetName: string;
  showWhitespace: boolean;
  autoSaveLabel: string;
  searchQuery: string;
  sort: DraftSortOption;
  canDuplicate: boolean;
  canSaveVariablePreset: boolean;
  canApplyVariablePreset: boolean;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: DraftSortOption) => void;
  onChangeDraft: <K extends keyof DraftInput>(field: K, value: DraftInput[K]) => void;
  onChangeDraftVariable: (name: string, value: string) => void;
  onSelectVariablePreset: (id: string | null) => void;
  onChangeVariablePresetName: (value: string) => void;
  onCreateVariablePreset: () => void;
  onApplyVariablePreset: () => void;
  onSaveVariablePreset: () => Promise<void>;
  onDeleteVariablePreset: () => Promise<void>;
  onCopyPreview: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onDeleteDraft: () => Promise<void>;
  onDuplicateDraft: () => Promise<void>;
  onTogglePinned: () => void;
  onRestoreDraftHistory: (historyId: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => void;
}

export function DraftWorkspace({
  drafts,
  totalDraftCount,
  draftHistory,
  templates,
  signatures,
  selectedDraftId,
  draftForm,
  previewSubject,
  previewText,
  checks,
  variableNames,
  variablePresets,
  selectedVariablePresetId,
  variablePresetName,
  showWhitespace,
  autoSaveLabel,
  searchQuery,
  sort,
  canDuplicate,
  canSaveVariablePreset,
  canApplyVariablePreset,
  onSelectDraft,
  onCreateDraft,
  onChangeSearchQuery,
  onChangeSort,
  onChangeDraft,
  onChangeDraftVariable,
  onSelectVariablePreset,
  onChangeVariablePresetName,
  onCreateVariablePreset,
  onApplyVariablePreset,
  onSaveVariablePreset,
  onDeleteVariablePreset,
  onCopyPreview,
  onSaveDraft,
  onDeleteDraft,
  onDuplicateDraft,
  onTogglePinned,
  onRestoreDraftHistory,
  onApplyTemplate,
}: DraftWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const selectedSignature = signatures.find((signature) => signature.id === draftForm.signatureId);
  const hasMissingSignature = Boolean(
    draftForm.signatureId &&
      !signatures.some((signature) => signature.id === draftForm.signatureId),
  );
  const previewDescription =
    selectedSignature?.name ?? (hasMissingSignature ? "ゴミ箱の署名を参照中" : "署名なし");
  const canCopyPreview = previewText.trim().length > 0;
  const canExpandPreview =
    previewText.trim().length > 0 || draftForm.subject.trim().length > 0 || checks.length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
    "本文プレビューがここに表示されます。";

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_320px]">
        <DraftListPane
          drafts={drafts}
          searchQuery={searchQuery}
          selectedDraftId={selectedDraftId}
          sort={sort}
          totalDraftCount={totalDraftCount}
          onChangeSearchQuery={onChangeSearchQuery}
          onChangeSort={onChangeSort}
          onCreateDraft={onCreateDraft}
          onSelectDraft={onSelectDraft}
        />

        <DraftEditorPane
          autoSaveLabel={autoSaveLabel}
          canDuplicate={canDuplicate}
          draftForm={draftForm}
          selectedDraftId={selectedDraftId}
          showWhitespace={showWhitespace}
          signatures={signatures}
          templates={templates}
          onApplyTemplate={onApplyTemplate}
          onChangeDraft={onChangeDraft}
          onDeleteDraft={onDeleteDraft}
          onDuplicateDraft={onDuplicateDraft}
          onSaveDraft={onSaveDraft}
          onTogglePinned={onTogglePinned}
        />

        <DraftPreviewPane
          canApplyVariablePreset={canApplyVariablePreset}
          canCopyPreview={canCopyPreview}
          canExpandPreview={canExpandPreview}
          canSaveVariablePreset={canSaveVariablePreset}
          checks={checks}
          draftForm={draftForm}
          draftHistoryCount={draftHistory.length}
          previewBodyText={previewBodyText}
          previewDescription={previewDescription}
          previewSubject={previewSubject}
          selectedVariablePresetId={selectedVariablePresetId}
          showWhitespace={showWhitespace}
          variableNames={variableNames}
          variablePresetName={variablePresetName}
          variablePresets={variablePresets}
          onApplyVariablePreset={onApplyVariablePreset}
          onChangeDraftVariable={onChangeDraftVariable}
          onChangeVariablePresetName={onChangeVariablePresetName}
          onCopyPreview={onCopyPreview}
          onCreateVariablePreset={onCreateVariablePreset}
          onDeleteVariablePreset={onDeleteVariablePreset}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenPreview={() => setIsWidePreviewOpen(true)}
          onSaveVariablePreset={onSaveVariablePreset}
          onSelectVariablePreset={onSelectVariablePreset}
        />
      </div>

      <PreviewOverlay
        action={
          <Button
            disabled={!canCopyPreview}
            size="sm"
            title="Ctrl/Cmd+Shift+C"
            variant="ghost"
            onClick={() => void onCopyPreview()}
          >
            コピー
          </Button>
        }
        description={previewDescription}
        isOpen={isWidePreviewOpen}
        title="下書きプレビュー"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <DraftPreviewDialogContent
          checks={checks}
          previewBodyText={previewBodyText}
          previewSubject={previewSubject}
        />
      </PreviewOverlay>

      <DraftHistoryOverlay
        historyEntries={draftHistory}
        isOpen={isHistoryOpen}
        showWhitespace={showWhitespace}
        signatures={signatures}
        onClose={() => setIsHistoryOpen(false)}
        onRestore={async (historyId) => {
          await onRestoreDraftHistory(historyId);
          setIsHistoryOpen(false);
        }}
      />
    </>
  );
}

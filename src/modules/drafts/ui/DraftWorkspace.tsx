import { useState } from "react";

import type { DraftSortOption } from "../../../shared/lib/list-sort";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template } from "../../templates/model";
import type { Draft, DraftHistoryEntry, DraftInput } from "../model";
import type { DraftProofreadingIssue } from "../proofreading/model";
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
  detailedCheckStatus: "idle" | "pending" | "running" | "ready" | "error";
  detailedCheckStatusLabel: string;
  draftForm: DraftInput;
  previewSubject: string;
  previewText: string;
  issues: DraftProofreadingIssue[];
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
  onApplyIssueSuggestion: (issueId: string) => void;
  onApplyVariablePreset: () => void;
  onSaveVariablePreset: () => Promise<void>;
  onDeleteVariablePreset: () => Promise<void>;
  onCopyPreview: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onDeleteDraft: () => Promise<void>;
  onDuplicateDraft: () => Promise<void>;
  onDisableIssueRule: (ruleId: string) => void;
  onIgnoreIssue: (issueId: string) => void;
  onRunDetailedCheck: () => void;
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
  detailedCheckStatus,
  detailedCheckStatusLabel,
  draftForm,
  previewSubject,
  previewText,
  issues,
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
  onApplyIssueSuggestion,
  onApplyVariablePreset,
  onSaveVariablePreset,
  onDeleteVariablePreset,
  onCopyPreview,
  onSaveDraft,
  onDeleteDraft,
  onDuplicateDraft,
  onDisableIssueRule,
  onIgnoreIssue,
  onRunDetailedCheck,
  onTogglePinned,
  onRestoreDraftHistory,
  onApplyTemplate,
}: DraftWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssueRequestKey, setSelectedIssueRequestKey] = useState(0);

  const selectedSignature = signatures.find((signature) => signature.id === draftForm.signatureId);
  const hasMissingSignature = Boolean(
    draftForm.signatureId &&
    !signatures.some((signature) => signature.id === draftForm.signatureId),
  );
  const previewDescription =
    selectedSignature?.name ?? (hasMissingSignature ? "ゴミ箱の署名を参照中" : "署名なし");
  const canCopyPreview = previewText.trim().length > 0;
  const canExpandPreview =
    previewText.trim().length > 0 || draftForm.subject.trim().length > 0 || issues.length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
    "本文プレビューがここに表示されます。";
  const activeIssue = issues.find((issue) => issue.id === selectedIssueId) ?? null;

  function selectIssue(issueId: string) {
    setSelectedIssueId(issueId);
    setSelectedIssueRequestKey((current) => current + 1);
    setIsWidePreviewOpen(false);
  }

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
          activeIssue={activeIssue}
          activeIssueRequestKey={selectedIssueRequestKey}
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
          detailedCheckStatus={detailedCheckStatus}
          detailedCheckStatusLabel={detailedCheckStatusLabel}
          draftForm={draftForm}
          draftHistoryCount={draftHistory.length}
          issues={issues}
          previewBodyText={previewBodyText}
          previewDescription={previewDescription}
          previewSubject={previewSubject}
          selectedIssueId={selectedIssueId}
          selectedVariablePresetId={selectedVariablePresetId}
          showWhitespace={showWhitespace}
          variableNames={variableNames}
          variablePresetName={variablePresetName}
          variablePresets={variablePresets}
          onApplyIssueSuggestion={onApplyIssueSuggestion}
          onApplyVariablePreset={onApplyVariablePreset}
          onChangeDraftVariable={onChangeDraftVariable}
          onChangeVariablePresetName={onChangeVariablePresetName}
          onCopyPreview={onCopyPreview}
          onCreateVariablePreset={onCreateVariablePreset}
          onDeleteVariablePreset={onDeleteVariablePreset}
          onDisableIssueRule={onDisableIssueRule}
          onIgnoreIssue={onIgnoreIssue}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenPreview={() => setIsWidePreviewOpen(true)}
          onRunDetailedCheck={onRunDetailedCheck}
          onSaveVariablePreset={onSaveVariablePreset}
          onSelectIssue={selectIssue}
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
          detailedCheckStatus={detailedCheckStatus}
          detailedCheckStatusLabel={detailedCheckStatusLabel}
          issues={issues}
          onApplyIssueSuggestion={onApplyIssueSuggestion}
          onDisableIssueRule={onDisableIssueRule}
          onIgnoreIssue={onIgnoreIssue}
          onRunDetailedCheck={onRunDetailedCheck}
          previewBodyText={previewBodyText}
          previewSubject={previewSubject}
          selectedIssueId={selectedIssueId}
          onSelectIssue={selectIssue}
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

import type { DraftSortOption } from "../../../shared/lib/list-sort";
import type { EditorSettings } from "../../../shared/ui/code-editor/editor-settings";
import type { Signature } from "../../signatures/model";
import type { Template } from "../../templates/model";
import type { Draft, DraftHistoryEntry, DraftInput } from "../model";
import type { DraftProofreadingIssue } from "../proofreading/model";
import type { VariablePreset } from "../variable-presets";
import { createDraftWorkspaceViewModel } from "./draft-workspace-view-model";
import { DraftHistoryOverlayController } from "./DraftHistoryOverlayController";
import { DraftPreviewOverlayContent } from "./DraftPreviewOverlayContent";
import { DraftEditorPane } from "./panes/DraftEditorPane";
import { DraftListPane } from "./panes/DraftListPane";
import { DraftPreviewPane } from "./panes/DraftPreviewPane";
import { useDraftWorkspaceUiState } from "./use-draft-workspace-ui-state";

interface DraftWorkspaceProps {
  activeTagFilter: string | null;
  availableTags: string[];
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
  editorSettings?: EditorSettings;
  showWhitespace: boolean;
  autoSaveLabel: string;
  searchQuery: string;
  sort: DraftSortOption;
  canCreateTemplate: boolean;
  canDuplicate: boolean;
  canSaveVariablePreset: boolean;
  canApplyVariablePreset: boolean;
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: DraftSortOption) => void;
  onChangeTagFilter: (tag: string | null) => void;
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
  onCreateTemplateFromDraft: () => void;
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
  activeTagFilter,
  availableTags,
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
  editorSettings,
  showWhitespace,
  autoSaveLabel,
  searchQuery,
  sort,
  canCreateTemplate,
  canDuplicate,
  canSaveVariablePreset,
  canApplyVariablePreset,
  onSelectDraft,
  onCreateDraft,
  onChangeSearchQuery,
  onChangeSort,
  onChangeTagFilter,
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
  onCreateTemplateFromDraft,
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
  const uiState = useDraftWorkspaceUiState();
  const viewModel = createDraftWorkspaceViewModel({
    draftForm,
    issues,
    previewText,
    selectedIssueId: uiState.selectedIssueId,
    showWhitespace,
    signatures,
  });

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_320px]">
        <DraftListPane
          activeTagFilter={activeTagFilter}
          availableTags={availableTags}
          drafts={drafts}
          searchQuery={searchQuery}
          selectedDraftId={selectedDraftId}
          sort={sort}
          totalDraftCount={totalDraftCount}
          onChangeSearchQuery={onChangeSearchQuery}
          onChangeSort={onChangeSort}
          onChangeTagFilter={onChangeTagFilter}
          onCreateDraft={onCreateDraft}
          onSelectDraft={onSelectDraft}
        />

        <DraftEditorPane
          availableTags={availableTags}
          activeIssue={viewModel.activeIssue}
          activeIssueRequestKey={uiState.selectedIssueRequestKey}
          autoSaveLabel={autoSaveLabel}
          canCreateTemplate={canCreateTemplate}
          canDuplicate={canDuplicate}
          draftForm={draftForm}
          editorSettings={editorSettings}
          selectedDraftId={selectedDraftId}
          showWhitespace={showWhitespace}
          signatures={signatures}
          templates={templates}
          onApplyTemplate={onApplyTemplate}
          onChangeDraft={onChangeDraft}
          onCreateTemplateFromDraft={onCreateTemplateFromDraft}
          onDeleteDraft={onDeleteDraft}
          onDuplicateDraft={onDuplicateDraft}
          onSaveDraft={onSaveDraft}
          onTogglePinned={onTogglePinned}
        />

        <DraftPreviewPane
          canApplyVariablePreset={canApplyVariablePreset}
          canCopyPreview={viewModel.canCopyPreview}
          canExpandPreview={viewModel.canExpandPreview}
          canSaveVariablePreset={canSaveVariablePreset}
          detailedCheckStatus={detailedCheckStatus}
          detailedCheckStatusLabel={detailedCheckStatusLabel}
          draftForm={draftForm}
          draftHistoryCount={draftHistory.length}
          issues={issues}
          previewBodyText={viewModel.previewBodyText}
          previewDescription={viewModel.previewDescription}
          previewSubject={previewSubject}
          selectedIssueId={uiState.selectedIssueId}
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
          onOpenHistory={uiState.openHistory}
          onOpenPreview={uiState.openWidePreview}
          onRunDetailedCheck={onRunDetailedCheck}
          onSaveVariablePreset={onSaveVariablePreset}
          onSelectIssue={uiState.selectIssue}
          onSelectVariablePreset={onSelectVariablePreset}
        />
      </div>

      <DraftPreviewOverlayContent
        canCopyPreview={viewModel.canCopyPreview}
        detailedCheckStatus={detailedCheckStatus}
        detailedCheckStatusLabel={detailedCheckStatusLabel}
        isOpen={uiState.isWidePreviewOpen}
        issues={issues}
        previewBodyText={viewModel.previewBodyText}
        previewDescription={viewModel.previewDescription}
        previewSubject={previewSubject}
        selectedIssueId={uiState.selectedIssueId}
        onApplyIssueSuggestion={onApplyIssueSuggestion}
        onClose={uiState.closeWidePreview}
        onCopyPreview={onCopyPreview}
        onDisableIssueRule={onDisableIssueRule}
        onIgnoreIssue={onIgnoreIssue}
        onRunDetailedCheck={onRunDetailedCheck}
        onSelectIssue={uiState.selectIssue}
      />

      <DraftHistoryOverlayController
        historyEntries={draftHistory}
        isOpen={uiState.isHistoryOpen}
        showWhitespace={showWhitespace}
        signatures={signatures}
        onClose={uiState.closeHistory}
        onRestoreDraftHistory={onRestoreDraftHistory}
      />
    </>
  );
}

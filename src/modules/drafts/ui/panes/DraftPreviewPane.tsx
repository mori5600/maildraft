import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel } from "../../../../shared/ui/primitives";
import type { DraftInput } from "../../model";
import type { DraftProofreadingIssue } from "../../proofreading/model";
import type { VariablePreset } from "../../variable-presets";
import { DraftIssueList } from "./DraftIssueList";
import { DraftVariablePresetPanel } from "./DraftVariablePresetPanel";

interface DraftPreviewPaneProps {
  detailedCheckStatus: "idle" | "pending" | "running" | "ready" | "error";
  detailedCheckStatusLabel: string;
  draftForm: DraftInput;
  draftHistoryCount: number;
  previewSubject: string;
  previewBodyText: string;
  issues: DraftProofreadingIssue[];
  selectedIssueId: string | null;
  variableNames: string[];
  variablePresets: VariablePreset[];
  selectedVariablePresetId: string | null;
  variablePresetName: string;
  previewDescription: string;
  showWhitespace: boolean;
  canCopyPreview: boolean;
  canExpandPreview: boolean;
  canSaveVariablePreset: boolean;
  canApplyVariablePreset: boolean;
  onOpenHistory: () => void;
  onOpenPreview: () => void;
  onApplyIssueSuggestion: (issueId: string) => void;
  onCopyPreview: () => Promise<void>;
  onChangeDraftVariable: (name: string, value: string) => void;
  onSelectVariablePreset: (id: string | null) => void;
  onChangeVariablePresetName: (value: string) => void;
  onCreateVariablePreset: () => void;
  onApplyVariablePreset: () => Promise<void>;
  onApplyRecommendedVariablePreset: (presetId: string) => Promise<void>;
  onDisableIssueRule: (ruleId: string) => void;
  onIgnoreIssue: (issueId: string) => void;
  onSaveVariablePreset: () => Promise<void>;
  onDeleteVariablePreset: () => Promise<void>;
  onRunDetailedCheck: () => void;
  onSelectIssue: (issueId: string) => void;
}

export function DraftPreviewPane({
  detailedCheckStatus,
  detailedCheckStatusLabel,
  draftForm,
  draftHistoryCount,
  previewSubject,
  previewBodyText,
  issues,
  selectedIssueId,
  variableNames,
  variablePresets,
  selectedVariablePresetId,
  variablePresetName,
  previewDescription,
  showWhitespace,
  canCopyPreview,
  canExpandPreview,
  canSaveVariablePreset,
  canApplyVariablePreset,
  onOpenHistory,
  onOpenPreview,
  onApplyIssueSuggestion,
  onCopyPreview,
  onChangeDraftVariable,
  onSelectVariablePreset,
  onChangeVariablePresetName,
  onCreateVariablePreset,
  onApplyVariablePreset,
  onApplyRecommendedVariablePreset,
  onDisableIssueRule,
  onIgnoreIssue,
  onSaveVariablePreset,
  onDeleteVariablePreset,
  onRunDetailedCheck,
  onSelectIssue,
}: DraftPreviewPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button
              disabled={draftHistoryCount === 0}
              size="sm"
              variant="ghost"
              onClick={onOpenHistory}
            >
              履歴
            </Button>
            <Button disabled={!canExpandPreview} size="sm" variant="ghost" onClick={onOpenPreview}>
              拡大
            </Button>
            <Button
              disabled={!canCopyPreview}
              size="sm"
              title="Ctrl/Cmd+Shift+C"
              variant="ghost"
              onClick={() => void onCopyPreview()}
            >
              コピー
            </Button>
          </div>
        }
        description={previewDescription}
        title="プレビュー"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            差し込み項目
          </div>
          <div className="mt-2.5 space-y-2.5">
            <DraftVariablePresetPanel
              canApplyVariablePreset={canApplyVariablePreset}
              canSaveVariablePreset={canSaveVariablePreset}
              draftForm={draftForm}
              selectedVariablePresetId={selectedVariablePresetId}
              showWhitespace={showWhitespace}
              variableNames={variableNames}
              variablePresetName={variablePresetName}
              variablePresets={variablePresets}
              onApplyRecommendedVariablePreset={onApplyRecommendedVariablePreset}
              onApplyVariablePreset={onApplyVariablePreset}
              onChangeDraftVariable={onChangeDraftVariable}
              onChangeVariablePresetName={onChangeVariablePresetName}
              onCreateVariablePreset={onCreateVariablePreset}
              onDeleteVariablePreset={onDeleteVariablePreset}
              onSaveVariablePreset={onSaveVariablePreset}
              onSelectVariablePreset={onSelectVariablePreset}
            />
          </div>
        </div>

        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            件名
          </div>
          <div className="mt-1.5 text-[13px] text-(--color-text-strong)">
            {previewSubject || "件名未設定"}
          </div>
        </div>

        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              校正結果
            </div>
            <Button
              disabled={detailedCheckStatus === "running"}
              size="sm"
              variant="ghost"
              onClick={onRunDetailedCheck}
            >
              詳細チェック
            </Button>
          </div>
          <div className="mt-1.5 text-xs leading-5 text-(--color-text-muted)">
            {detailedCheckStatusLabel}
          </div>
          <DraftIssueList
            issues={issues}
            selectedIssueId={selectedIssueId}
            onApplyIssueSuggestion={onApplyIssueSuggestion}
            onDisableIssueRule={onDisableIssueRule}
            onIgnoreIssue={onIgnoreIssue}
            onSelectIssue={onSelectIssue}
          />
        </div>

        <div className="px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            本文
          </div>
          <pre className="mail-preview-text mt-2 overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-3.5 py-3 whitespace-pre-wrap text-(--color-preview-text)">
            {previewBodyText}
          </pre>
        </div>
      </div>
    </Panel>
  );
}

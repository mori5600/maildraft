import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import type { DraftProofreadingIssue } from "../proofreading/model";
import { DraftPreviewDialogContent } from "./panes/DraftPreviewDialogContent";

interface DraftPreviewOverlayContentProps {
  canCopyPreview: boolean;
  detailedCheckStatus: "idle" | "pending" | "running" | "ready" | "error";
  detailedCheckStatusLabel: string;
  isOpen: boolean;
  issues: DraftProofreadingIssue[];
  previewBodyText: string;
  previewDescription: string;
  previewSubject: string;
  selectedIssueId: string | null;
  onApplyIssueSuggestion: (issueId: string) => void;
  onClose: () => void;
  onCopyPreview: () => Promise<void>;
  onDisableIssueRule: (ruleId: string) => void;
  onIgnoreIssue: (issueId: string) => void;
  onRunDetailedCheck: () => void;
  onSelectIssue: (issueId: string) => void;
}

export function DraftPreviewOverlayContent({
  canCopyPreview,
  detailedCheckStatus,
  detailedCheckStatusLabel,
  isOpen,
  issues,
  previewBodyText,
  previewDescription,
  previewSubject,
  selectedIssueId,
  onApplyIssueSuggestion,
  onClose,
  onCopyPreview,
  onDisableIssueRule,
  onIgnoreIssue,
  onRunDetailedCheck,
  onSelectIssue,
}: DraftPreviewOverlayContentProps) {
  return (
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
      isOpen={isOpen}
      title="下書きプレビュー"
      onClose={onClose}
    >
      <DraftPreviewDialogContent
        detailedCheckStatus={detailedCheckStatus}
        detailedCheckStatusLabel={detailedCheckStatusLabel}
        issues={issues}
        previewBodyText={previewBodyText}
        previewSubject={previewSubject}
        selectedIssueId={selectedIssueId}
        onApplyIssueSuggestion={onApplyIssueSuggestion}
        onDisableIssueRule={onDisableIssueRule}
        onIgnoreIssue={onIgnoreIssue}
        onRunDetailedCheck={onRunDetailedCheck}
        onSelectIssue={onSelectIssue}
      />
    </PreviewOverlay>
  );
}

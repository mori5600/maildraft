import { Button } from "../../../../shared/ui/primitives";
import type { DraftProofreadingIssue } from "../../proofreading/model";
import { DraftIssueList } from "./DraftIssueList";

interface DraftPreviewDialogContentProps {
  detailedCheckStatus: "idle" | "pending" | "running" | "ready" | "error";
  detailedCheckStatusLabel: string;
  previewSubject: string;
  previewBodyText: string;
  issues: DraftProofreadingIssue[];
  selectedIssueId: string | null;
  onApplyIssueSuggestion: (issueId: string) => void;
  onDisableIssueRule: (ruleId: string) => void;
  onIgnoreIssue: (issueId: string) => void;
  onRunDetailedCheck: () => void;
  onSelectIssue: (issueId: string) => void;
}

export function DraftPreviewDialogContent({
  detailedCheckStatus,
  detailedCheckStatusLabel,
  previewSubject,
  previewBodyText,
  issues,
  selectedIssueId,
  onApplyIssueSuggestion,
  onDisableIssueRule,
  onIgnoreIssue,
  onRunDetailedCheck,
  onSelectIssue,
}: DraftPreviewDialogContentProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) p-4">
        <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
          本文
        </div>
        <pre className="mail-preview-text mt-2.5 min-h-120 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
          {previewBodyText}
        </pre>
      </section>

      <div className="space-y-3">
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) p-4">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            件名
          </div>
          <div className="mt-2.5 text-[13px] text-(--color-text-strong)">
            {previewSubject || "件名未設定"}
          </div>
        </section>

        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) p-4">
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
        </section>
      </div>
    </div>
  );
}

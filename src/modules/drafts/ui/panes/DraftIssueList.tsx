import { visualizeWhitespace } from "../../../../shared/lib/whitespace";
import { Button } from "../../../../shared/ui/primitives";
import {
  draftProofreadingFieldLabel,
  type DraftProofreadingIssue,
  draftProofreadingSeverityLabel,
} from "../../proofreading/model";

interface DraftIssueListProps {
  issues: DraftProofreadingIssue[];
  selectedIssueId: string | null;
  onApplyIssueSuggestion: (issueId: string) => void;
  onDisableIssueRule: (ruleId: string) => void;
  onIgnoreIssue: (issueId: string) => void;
  onSelectIssue: (issueId: string) => void;
}

export function DraftIssueList({
  issues,
  selectedIssueId,
  onApplyIssueSuggestion,
  onDisableIssueRule,
  onIgnoreIssue,
  onSelectIssue,
}: DraftIssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="mt-2 rounded-[7px] border border-(--color-success-border) bg-(--color-success-bg) px-3 py-2.5 text-[13px] text-(--color-success-text)">
        現在の校正では問題は見つかりませんでした。
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {issues.map((issue) => (
        <section
          key={issue.id}
          className={issueCardClassName(issue.severity, selectedIssueId === issue.id)}
        >
          <button
            aria-pressed={selectedIssueId === issue.id}
            className="w-full text-left outline-none"
            type="button"
            onClick={() => onSelectIssue(issue.id)}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={issueSeverityBadgeClassName(issue.severity)}>
                  {draftProofreadingSeverityLabel(issue.severity)}
                </span>
                <span className="text-[10px] tracking-[0.12em] text-(--color-text-subtle) uppercase">
                  {draftProofreadingFieldLabel(issue.field)}
                </span>
              </div>
              <div className="text-[13px] font-medium text-(--color-text-strong)">
                {issue.title}
              </div>
            </div>

            <p className="mt-1.5 text-xs leading-5 text-(--color-text-muted)">
              {issue.description}
            </p>

            {issue.excerpt ? (
              <pre className="mt-2 overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-2.5 py-2 text-xs leading-5 whitespace-pre-wrap text-(--color-text-strong)">
                {visualizeWhitespace(issue.excerpt)}
              </pre>
            ) : null}
          </button>

          <div className="mt-2 flex flex-wrap gap-2">
            {issue.suggestion ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onApplyIssueSuggestion(issue.id)}
              >
                {issue.suggestion.label}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onDisableIssueRule(issue.ruleId)}>
              ルールを無効化
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onIgnoreIssue(issue.id)}>
              今回のみ無視
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}

function issueCardClassName(
  severity: DraftProofreadingIssue["severity"],
  isSelected: boolean,
): string {
  const selectedClassName = isSelected
    ? "shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-focus-ring)]"
    : "";

  switch (severity) {
    case "error":
      return `rounded-[7px] border border-(--color-button-danger-border) bg-(--color-button-danger-bg) px-3 py-2.5 ${selectedClassName}`;
    case "warning":
      return `rounded-[7px] border border-(--color-warning-border) bg-(--color-warning-bg) px-3 py-2.5 ${selectedClassName}`;
    case "info":
      return `rounded-[7px] border border-(--color-pill-neutral-border) bg-(--color-pill-neutral-bg) px-3 py-2.5 ${selectedClassName}`;
  }
}

function issueSeverityBadgeClassName(severity: DraftProofreadingIssue["severity"]): string {
  switch (severity) {
    case "error":
      return "inline-flex rounded-[7px] border border-(--color-button-danger-border) bg-(--color-button-danger-bg) px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-(--color-button-danger-text) uppercase";
    case "warning":
      return "inline-flex rounded-[7px] border border-(--color-warning-border) bg-(--color-warning-bg) px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-(--color-warning-text) uppercase";
    case "info":
      return "inline-flex rounded-[7px] border border-(--color-pill-accent-border) bg-(--color-pill-accent-bg) px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-(--color-pill-accent-text) uppercase";
  }
}

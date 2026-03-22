import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";

import type { DraftInput } from "../model";
import { createDraftProofreadingRunner } from "../proofreading/create-proofreading-runner";
import {
  applyDraftProofreadingSuggestion,
  type DraftProofreadingDetailedStatus,
  draftProofreadingDetailedStatusLabel,
  type DraftProofreadingIssue,
  mergeDraftProofreadingIssues,
} from "../proofreading/model";
import { filterVisibleProofreadingIssues } from "./draft-workspace-selectors";

const DETAILED_PROOFREADING_DEBOUNCE_MS = 700;

interface UseDraftProofreadingStateOptions {
  disabledRuleIds: string[];
  draftForm: DraftInput;
  onDisableProofreadingRule: (ruleId: string) => Promise<void>;
  onNotice: (message: string) => void;
  renderIssues: DraftProofreadingIssue[];
  setDraftForm: Dispatch<SetStateAction<DraftInput>>;
}

export function useDraftProofreadingState({
  disabledRuleIds,
  draftForm,
  onDisableProofreadingRule,
  onNotice,
  renderIssues,
  setDraftForm,
}: UseDraftProofreadingStateOptions) {
  const [detailedCheckStatus, setDetailedCheckStatus] = useState<DraftProofreadingDetailedStatus>(
    () => (typeof Worker === "undefined" ? "idle" : "pending"),
  );
  const [detailedCheckErrorMessage, setDetailedCheckErrorMessage] = useState<string | null>(null);
  const [detailedIssues, setDetailedIssues] = useState<DraftProofreadingIssue[]>([]);
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<string[]>([]);
  const detailedCheckTimerRef = useRef<number | null>(null);
  const detailedProofreadingRunnerRef =
    useRef<ReturnType<typeof createDraftProofreadingRunner>>(null);
  const detailedRequestVersionRef = useRef(0);
  const runDetailedProofreadingRef = useRef<() => Promise<void>>(async () => {});
  const mergedIssues = useMemo(
    () => mergeDraftProofreadingIssues(renderIssues, detailedIssues),
    [detailedIssues, renderIssues],
  );
  const visibleIssues = useMemo(
    () => filterVisibleProofreadingIssues(mergedIssues, ignoredIssueIds, disabledRuleIds),
    [disabledRuleIds, ignoredIssueIds, mergedIssues],
  );

  function clearDetailedCheckTimer() {
    if (detailedCheckTimerRef.current === null) {
      return;
    }

    window.clearTimeout(detailedCheckTimerRef.current);
    detailedCheckTimerRef.current = null;
  }

  function ensureDetailedProofreadingRunner() {
    if (typeof Worker === "undefined") {
      return null;
    }

    if (detailedProofreadingRunnerRef.current) {
      return detailedProofreadingRunnerRef.current;
    }

    try {
      const runner = createDraftProofreadingRunner();
      detailedProofreadingRunnerRef.current = runner;
      return runner;
    } catch (error) {
      setDetailedIssues([]);
      setDetailedCheckErrorMessage(toDetailedProofreadingErrorMessage(error));
      setDetailedCheckStatus("error");
      return null;
    }
  }

  useEffect(() => {
    return () => {
      clearDetailedCheckTimer();
      detailedRequestVersionRef.current += 1;
      detailedProofreadingRunnerRef.current?.dispose();
      detailedProofreadingRunnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    runDetailedProofreadingRef.current = async () => {
      clearDetailedCheckTimer();
      const runner = ensureDetailedProofreadingRunner();

      if (!runner) {
        return;
      }

      const requestVersion = ++detailedRequestVersionRef.current;
      setDetailedCheckErrorMessage(null);
      setDetailedCheckStatus("running");

      try {
        const nextIssues = await runner.run({
          draft: draftForm,
        });

        if (requestVersion !== detailedRequestVersionRef.current) {
          return;
        }

        setDetailedIssues(nextIssues);
        setDetailedCheckErrorMessage(null);
        setDetailedCheckStatus("ready");
      } catch (error) {
        if (requestVersion !== detailedRequestVersionRef.current) {
          return;
        }

        setDetailedIssues([]);
        setDetailedCheckErrorMessage(toDetailedProofreadingErrorMessage(error));
        setDetailedCheckStatus("error");
      }
    };
  }, [draftForm]);

  useEffect(() => {
    clearDetailedCheckTimer();

    if (typeof Worker === "undefined") {
      return;
    }

    detailedCheckTimerRef.current = window.setTimeout(() => {
      detailedCheckTimerRef.current = null;
      void runDetailedProofreadingRef.current();
    }, DETAILED_PROOFREADING_DEBOUNCE_MS);

    return () => {
      clearDetailedCheckTimer();
    };
  }, [draftForm.body, draftForm.closing, draftForm.id, draftForm.opening, draftForm.subject]);

  function markDetailedProofreadingPending() {
    setDetailedCheckErrorMessage(null);
    setDetailedCheckStatus(typeof Worker === "undefined" ? "idle" : "pending");
  }

  function resetIgnoredIssues() {
    setIgnoredIssueIds([]);
  }

  function resetDetailedProofreading() {
    clearDetailedCheckTimer();
    detailedRequestVersionRef.current += 1;
    setDetailedIssues([]);
    setDetailedCheckErrorMessage(null);
    markDetailedProofreadingPending();
  }

  function resetProofreadingState() {
    resetIgnoredIssues();
    resetDetailedProofreading();
  }

  function ignoreIssueOnce(issueId: string) {
    setIgnoredIssueIds((current) => (current.includes(issueId) ? current : [...current, issueId]));
  }

  function applyIssueSuggestion(issueId: string) {
    const issue = mergedIssues.find((item) => item.id === issueId);

    if (!issue?.suggestion) {
      return;
    }

    const { suggestion } = issue;

    setDraftForm((current) => applyDraftProofreadingSuggestion(current, suggestion));
    setIgnoredIssueIds((current) => current.filter((id) => id !== issueId));
    onNotice(`${issue.title} の候補を適用しました。`);
  }

  function runDetailedCheckNow() {
    void runDetailedProofreadingRef.current();
  }

  async function disableIssueRule(ruleId: string) {
    await onDisableProofreadingRule(ruleId);
  }

  return {
    detailedCheckStatus,
    detailedCheckStatusLabel: draftProofreadingDetailedStatusLabel(
      detailedCheckStatus,
      detailedCheckErrorMessage,
    ),
    issues: visibleIssues,
    markDetailedProofreadingPending,
    onApplyIssueSuggestion: applyIssueSuggestion,
    onDisableIssueRule: disableIssueRule,
    onIgnoreIssue: ignoreIssueOnce,
    onRunDetailedCheck: runDetailedCheckNow,
    resetProofreadingState,
  };
}

function toDetailedProofreadingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "不明なエラー";
}

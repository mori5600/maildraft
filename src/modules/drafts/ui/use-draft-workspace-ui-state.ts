import { useState } from "react";

export function useDraftWorkspaceUiState() {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssueRequestKey, setSelectedIssueRequestKey] = useState(0);

  function openHistory() {
    setIsHistoryOpen(true);
  }

  function closeHistory() {
    setIsHistoryOpen(false);
  }

  function openWidePreview() {
    setIsWidePreviewOpen(true);
  }

  function closeWidePreview() {
    setIsWidePreviewOpen(false);
  }

  function selectIssue(issueId: string) {
    setSelectedIssueId(issueId);
    setSelectedIssueRequestKey((current) => current + 1);
    closeWidePreview();
  }

  return {
    closeHistory,
    closeWidePreview,
    isHistoryOpen,
    isWidePreviewOpen,
    openHistory,
    openWidePreview,
    selectedIssueId,
    selectedIssueRequestKey,
    selectIssue,
  };
}

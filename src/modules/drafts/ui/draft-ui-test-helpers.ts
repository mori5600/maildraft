export function createIssue() {
  return {
    description: "説明",
    excerpt: "了解しました",
    field: "body" as const,
    id: "issue-1",
    ruleId: "discouraged.understood",
    severity: "warning" as const,
    suggestion: {
      edits: [],
      label: "言い換える",
    },
    title: "非推奨表現の可能性があります。",
  };
}
